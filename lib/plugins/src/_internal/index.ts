import { TypedEventEmitter } from '@revenge-mod/discord/common/utils'
import {
    callBridgeMethod,
    callBridgeMethodSync,
    registerJSMethod,
} from '@revenge-mod/modules/native'
import { getErrorStack } from '@revenge-mod/utils/error'
import { sleepReject } from '@revenge-mod/utils/promise'
import { pUnscopedApi as uapi } from '../apis'
import { PluginStatus as Status } from '../constants'
import {
    addPluginApiDecorator,
    decoratePluginApi,
    pApis,
    pDecoratorsInit,
    pDecoratorsPreInit,
    pDecoratorsStart,
} from './decorators'
import {
    computePendingNodes,
    pLeafOrSingleNodes,
    pListOrdered,
    pPending,
} from './dependency-graph'
import type {
    InitPluginApi,
    Plugin,
    PluginApi,
    PluginApiExtensionsOptions,
    PluginCleanup,
    PluginDependency,
    PluginManifest,
    PluginOptions,
    PluginOptionsFactory,
    PreInitPluginApi,
} from '../types'

export type AnyPlugin = Plugin<any, any> & {
    /** @internal */
    flags: number
}

const MaxWaitTime = 5000

// TODO: Maybe remove this later?
// This is never used in bridge, but still used internally by JS.
export const PluginFlags = {
    Enabled: 1 << 0,
    PendingReload: 1 << 1,
    Errored: 1 << 2,
    EnabledLate: 1 << 3,
    /**
     * Marks the plugin as pending an update. Set when {@link PluginFlags.PendingReload} is set when stopping the plugin to update.
     * This means for the update to be applied safely, the updated plugin can only be started after a reload.
     */
    PendingUpdate: 1 << 4,
}

const Flag = PluginFlags

const PluginApiLevel = {
    None: 0,
    PreInit: 1,
    Init: 2,
    Start: 3,
} as const

export const InternalPluginFlags = {
    /**
     * Marks the plugin as internal.
     */
    Internal: 1 << 0,
    /**
     * Marks the plugin as essential. This means it should not be removed, disabled, or stopped by normal means.
     */
    Essential: 1 << 1,
    /**
     * Marks the plugin as an API plugin, which decorates all other plugins.
     * API plugins themselves won't be decorated by other API plugins unless explicitly declared in dependencies.
     */
    API: 1 << 2,
}

export interface InternalPluginMeta {
    handleError: (e: unknown) => Promise<void>
    promises: Promise<void>[]
    cleanups: PluginCleanup[]
    iflags: number
    apiLevel: number
    dependents: AnyPlugin[]
    dependencies?: AnyPlugin[]
    options: PluginOptions<any>
    optionsFactory?: PluginOptionsFactory<any>
    flags: number
}

export const pUnscopedApi = uapi
export const pEmitter = new TypedEventEmitter<{
    register: [AnyPlugin, PluginOptions<any>, update?: true]
    unregister: [AnyPlugin]
    disabled: [AnyPlugin]
    enabled: [AnyPlugin]
    preInited: [AnyPlugin]
    inited: [AnyPlugin]
    started: [AnyPlugin]
    stopped: [AnyPlugin]
    errored: [AnyPlugin, unknown]
    flagUpdate: [AnyPlugin]
    install: [PluginInstallEvent]
}>()

export type PluginInstallEvent =
    | { error: false; manifest: PluginManifest; updated: boolean }
    | { error: string }

export const pList = new Map<PluginManifest['id'], AnyPlugin>()
const pMetadata = new WeakMap<AnyPlugin, InternalPluginMeta>()

const { states: InitialPersistedStates }: PersistedPluginStates =
    callBridgeMethodSync('revenge.plugins.states.read', []) ?? {
        states: {},
    }

// Native is the source of truth, we're expecting dispatches from native to sync states
registerJSMethod('revenge.plugins.states.update', (id, state) => {
    applyPluginFlags(
        id as PluginManifest['id'],
        pluginStateToFlags(state as PluginStateObject),
    )
})

function pluginStateToFlags(state: PluginStateObject): number {
    return (
        (state.enabled ? Flag.Enabled : 0) |
        (state.pendingReload ? Flag.PendingReload : 0) |
        (state.errored ? Flag.Errored : 0) |
        (state.enabledLate ? Flag.EnabledLate : 0)
    )
}

async function applyPluginFlags(id: PluginManifest['id'], flags: number) {
    const plugin = pList.get(id)
    if (!plugin || plugin.flags === flags) return

    const wasEnabled = plugin.flags & Flag.Enabled
    const nowEnabled = flags & Flag.Enabled

    if (wasEnabled && !nowEnabled) {
        if (plugin.status && !(plugin.status & Status.Stopping))
            await stopPlugin(plugin)
        plugin.flags = flags
        pEmitter.emit('disabled', plugin)
    } else {
        plugin.flags = flags
        if (!wasEnabled && nowEnabled) pEmitter.emit('enabled', plugin)
    }
}

/**
 * Registers a new plugin with the system.
 *
 * @param manifest The manifest of the plugin.
 * @param options The options for the plugin.
 * @param defflags The default flags for the plugin.
 * @param iflags The internal flags for the plugin.
 */
export function registerPlugin<O extends PluginApiExtensionsOptions>(
    manifest: PluginManifest,
    options: PluginOptions<O> | PluginOptionsFactory<O>,
    defflags: number,
    iflags: number,
) {
    // TODO(plugins): verify plugin manifest
    if (pList.has(manifest.id))
        throw new Error(`Plugin with ID "${manifest.id}" already registered`)

    const factory = typeof options === 'function' ? options : undefined
    const resolved = typeof options === 'function' ? undefined : options

    const plugin = {
        errors: [],
        manifest,
        lifecycles: {
            preInit: resolved?.preInit,
            init: resolved?.init,
            start: resolved?.start,
            stop: resolved?.stop,
        },
        SettingsComponent: resolved?.SettingsComponent,
        status: 0,
        disable: () => disablePlugin(plugin),
        stop: () => stopPlugin(plugin),
        requireReload: () => {
            plugin.flags |= Flag.PendingReload
        },
        api: undefined,
        set flags(flags: number) {
            if (meta.flags === flags) return
            meta.flags = flags
            pEmitter.emit('flagUpdate', this)
        },
        get flags() {
            return meta.flags
        },
    }

    const meta: InternalPluginMeta = {
        cleanups: [],
        promises: [],
        iflags,
        apiLevel: PluginApiLevel.None,
        dependents: [],
        handleError: e => handlePluginError(e, plugin),
        options: resolved ?? {},
        optionsFactory: factory,
        flags: InitialPersistedStates[manifest.id]
            ? pluginStateToFlags(InitialPersistedStates[manifest.id])
            : defflags,
    }

    pMetadata.set(plugin, meta)
    pList.set(manifest.id, plugin)

    if (iflags & InternalPluginFlags.API) {
        pLeafOrSingleNodes.add(plugin)
        pApis.add(plugin)
    }
    // Only add to pending if the plugin is enabled
    else if (isPluginEnabled(plugin)) pPending.add(plugin)

    pEmitter.emit('register', plugin, meta.options)

    return { id: manifest.id } satisfies PluginDependency
}

/**
 * Gets dependencies for a plugin.
 */
export function getPluginDependencies(plugin: AnyPlugin): AnyPlugin[] {
    const meta = getInternalPluginMeta(plugin)!
    if (meta.dependencies) return meta.dependencies

    const { dependencies, id } = plugin.manifest
    const deps: AnyPlugin[] = []

    if (dependencies?.length)
        for (const { id: depId } of dependencies) {
            const dep = pList.get(depId)

            if (dep) {
                if (isPluginEnabled(dep)) deps.push(dep)
                else
                    throw new Error(
                        `Plugin "${id}" depends on disabled plugin "${depId}"`,
                    )
            } else {
                // TODO: Once external plugins are implemented, we will have to check the external plugin registry here as well
                // External plugin registry should ideally be Record<PluginManifest['id'], [PluginManifest, Flags: number, PluginCode: string]>
                // Then we register the plugin here and do dep = pList.get(id) again

                throw new Error(
                    `Plugin "${id}" depends on unregistered plugin "${depId}"`,
                )
            }
        }

    return (meta.dependencies = deps)
}

export function isPluginEnabled(plugin: AnyPlugin): boolean {
    return Boolean((plugin as AnyPlugin).flags & Flag.Enabled)
}

export function isPluginEnabledLate(plugin: AnyPlugin): boolean {
    return Boolean((plugin as AnyPlugin).flags & Flag.EnabledLate)
}

export function isPluginEssential({ iflags }: InternalPluginMeta): boolean {
    return Boolean(iflags & InternalPluginFlags.Essential)
}

export function isPluginInternal({ iflags }: InternalPluginMeta): boolean {
    return Boolean(iflags & InternalPluginFlags.Internal)
}

export function isPluginErrored(plugin: AnyPlugin): boolean {
    return Boolean((plugin as AnyPlugin).flags & Flag.Errored)
}

export function isPluginPendingReload(plugin: AnyPlugin): boolean {
    return Boolean((plugin as AnyPlugin).flags & Flag.PendingReload)
}

export function isPluginPendingUpdate(plugin: AnyPlugin): boolean {
    return Boolean((plugin as AnyPlugin).flags & Flag.PendingUpdate)
}

/**
 * Requires that the plugin is in a state where it can be started, all of:
 * - Enabled
 * - Not pending an update
 */
function requirePluginStartableState(plugin: AnyPlugin) {
    if (!isPluginEnabled(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" is not enabled`)

    if (isPluginPendingUpdate(plugin))
        throw new Error(
            `Plugin "${plugin.manifest.id}" is pending an update and cannot be started`,
        )
}

/**
 * Checks if a plugin is startable.
 *
 * @see {@link requirePluginStartableState}.
 */
export function isPluginStartable(plugin: AnyPlugin): boolean {
    try {
        requirePluginStartableState(plugin)
        return true
    } catch {
        return false
    }
}

/**
 * Handles errors that occur in plugins.
 */
async function handlePluginError(e: unknown, plugin: AnyPlugin) {
    plugin.errors.push(e)
    plugin.flags |= Flag.Errored

    nativeLoggingHook(
        `\u001b[31mPlugin "${plugin.manifest.id}" encountered an error: ${getErrorStack(e)}\u001b[0m`,
        2,
    )

    plugin.api?.logger?.error('Plugin encountered an error', e)
    pEmitter.emit('errored', plugin, e)

    if (!isPluginEssential(getInternalPluginMeta(plugin)!))
        await plugin.disable()
}

/**
 * Resolves a deferred options factory, populating the plugin's lifecycles and options.
 */
function resolvePluginOptions(plugin: AnyPlugin, meta: InternalPluginMeta) {
    const { optionsFactory } = meta
    if (!optionsFactory) return

    meta.optionsFactory = undefined

    try {
        const options = optionsFactory()

        meta.options = options
        plugin.lifecycles.preInit = options.preInit
        plugin.lifecycles.init = options.init
        plugin.lifecycles.start = options.start
        plugin.lifecycles.stop = options.stop
        plugin.SettingsComponent = options.SettingsComponent
    } catch (e) {
        meta.handleError(e)
    }
}

/**
 * Prepares the plugin API for the preInit lifecycle.
 */
function tryPreparePluginPreInit(plugin: AnyPlugin) {
    const meta = getInternalPluginMeta(plugin)!
    if (meta.apiLevel >= PluginApiLevel.PreInit) return

    // Clear errors from previous runs
    plugin.errors = []
    plugin.flags &= ~Flag.Errored

    resolvePluginOptions(plugin, meta)

    plugin.api = {
        cleanup: (...items) => {
            meta.cleanups.push(...items)
        },
        plugin,
        unscoped: pUnscopedApi,
        decorate: decorator => {
            addPluginApiDecorator(pDecoratorsPreInit, plugin, decorator)
        },
    } satisfies PreInitPluginApi

    decoratePluginApi(pDecoratorsPreInit, plugin, meta)
    meta.apiLevel = PluginApiLevel.PreInit
}

/**
 * Prepares the plugin API for the init lifecycle.
 */
function tryPreparePluginInit(plugin: AnyPlugin) {
    const meta = getInternalPluginMeta(plugin)!
    if (meta.apiLevel >= PluginApiLevel.Init) return

    const api = plugin.api as InitPluginApi

    api.decorate = decorator => {
        addPluginApiDecorator(pDecoratorsInit, plugin, decorator)
    }

    decoratePluginApi(pDecoratorsInit, plugin, meta)
    meta.apiLevel = PluginApiLevel.Init
}

/**
 * Prepares the plugin API for the start lifecycle.
 */
function tryPreparePluginStart(plugin: AnyPlugin) {
    const meta = getInternalPluginMeta(plugin)!
    if (meta.apiLevel >= PluginApiLevel.Start) return

    const api = plugin.api as PluginApi

    api.decorate = decorator => {
        addPluginApiDecorator(pDecoratorsStart, plugin, decorator)
    }

    decoratePluginApi(pDecoratorsStart, plugin, meta)
    meta.apiLevel = PluginApiLevel.Start
}

/**
 * Disables a plugin, as well as all its dependents.
 */
export async function disablePlugin(plugin: AnyPlugin) {
    requirePluginStartableState(plugin)

    const meta = getInternalPluginMeta(plugin)!

    if (isPluginEssential(meta))
        throw new Error(
            `Plugin "${plugin.manifest.id}" is essential and cannot be disabled`,
        )

    const { dependents } = meta

    await Promise.all(
        dependents.map(dep => {
            if (dep.flags & Flag.Enabled) return disablePlugin(dep)
        }),
    )

    // Stop the plugin if needed
    if (plugin.status && !(plugin.status & Status.Stopping))
        await stopPlugin(plugin)

    await callBridgeMethod('revenge.plugins.states.setEnabled', [
        plugin.manifest.id,
        false,
    ])

    plugin.flags &= ~Flag.Enabled
    pEmitter.emit('disabled', plugin)
}

/**
 * Enables a plugin, as well as all its dependencies.
 */
export async function enablePlugin(plugin: AnyPlugin) {
    if (isPluginEnabled(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" is already enabled`)

    await Promise.all(
        getPluginDependencies(plugin).map(dep => {
            if (!isPluginEnabled(dep)) return enablePlugin(dep)
        }),
    )

    await callBridgeMethod('revenge.plugins.states.setEnabled', [
        plugin.manifest.id,
        true,
    ])

    plugin.flags |= Flag.Enabled
    pEmitter.emit('enabled', plugin)
}

export async function runPluginLate(plugin: AnyPlugin) {
    requirePluginStartableState(plugin)

    if (plugin.status & Status.Started)
        throw new Error(`Plugin "${plugin.manifest.id}" is already started`)

    // Reset previous computations
    pListOrdered.length = 0
    pPending.add(plugin)
    computePendingNodes()

    await Promise.all(
        // If the plugin is stopped, we should initialize it
        pListOrdered
            .filter(plugin => !plugin.status)
            .map(async function runLate(plugin) {
                plugin.flags |= Flag.EnabledLate

                // Plugin would already be started native-side if it was not started late
                // But on late starts (enable, fresh install), we must start the native side too
                await callBridgeMethod('revenge.plugins.loader.start', [
                    plugin.manifest.id,
                ])

                // Prepare the plugin API
                await preInitPlugin(plugin)
                await initPlugin(plugin)
                await startPlugin(plugin)
            }),
    )
}

/**
 * Runs the preInit lifecycle of a plugin.
 */
export async function preInitPlugin(plugin: AnyPlugin) {
    requirePluginStartableState(plugin)

    const {
        manifest: { id },
    } = plugin

    if (plugin.status & (Status.PreIniting | Status.PreInited))
        throw new Error(
            `Plugin preInit lifecycle for "${id}" is already running`,
        )

    tryPreparePluginPreInit(plugin)

    const { lifecycles } = plugin
    const { promises, handleError } = getInternalPluginMeta(plugin)!

    try {
        if (!lifecycles.preInit) return

        plugin.status |= Status.PreIniting

        try {
            const prom = lifecycles.preInit.apply(plugin, [
                plugin.api as PreInitPluginApi,
            ])
            promises.push(prom)
            await prom
        } catch (e) {
            await handleError(e)
        } finally {
            plugin.status &= ~Status.PreIniting
        }
    } finally {
        if (!isPluginErrored(plugin)) {
            plugin.status |= Status.PreInited
            pEmitter.emit('preInited', plugin)
        }
    }
}

/**
 * Runs the init lifecycle of a plugin.
 */
export async function initPlugin(plugin: AnyPlugin) {
    requirePluginStartableState(plugin)

    const {
        manifest: { id },
    } = plugin

    const meta = getInternalPluginMeta(plugin)!

    if (plugin.status & (Status.Initing | Status.Inited))
        throw new Error(`Plugin init lifecycle for "${id}" is already running`)

    tryPreparePluginPreInit(plugin)
    tryPreparePluginInit(plugin)

    const { lifecycles } = plugin
    const { promises, handleError } = meta

    try {
        if (!lifecycles.init) return

        plugin.status |= Status.Initing

        try {
            const prom = lifecycles.init.apply(plugin, [
                plugin.api as InitPluginApi,
            ])
            promises.push(prom)
            await prom
        } catch (e) {
            await handleError(e)
        } finally {
            plugin.status &= ~Status.Initing
        }
    } finally {
        if (!isPluginErrored(plugin)) {
            plugin.status |= Status.Inited
            pEmitter.emit('inited', plugin)
        }
    }
}

/**
 * Starts a plugin by running its start lifecycle.
 */
export async function startPlugin(plugin: AnyPlugin) {
    requirePluginStartableState(plugin)

    const {
        manifest: { id },
    } = plugin

    if (plugin.status & (Status.Starting | Status.Started))
        throw new Error(`Plugin start lifecycle for "${id}" is already running`)

    tryPreparePluginPreInit(plugin)
    tryPreparePluginInit(plugin)
    tryPreparePluginStart(plugin)

    const { lifecycles } = plugin
    const { promises, handleError } = getInternalPluginMeta(plugin)!

    try {
        if (!lifecycles.start) return

        plugin.status |= Status.Starting

        try {
            const prom = lifecycles.start.apply(plugin, [
                plugin.api as PluginApi,
            ])
            promises.push(prom)
            await prom
        } catch (e) {
            await handleError(e)
        } finally {
            plugin.status &= ~Status.Starting
        }
    } finally {
        if (!isPluginErrored(plugin)) {
            plugin.status |= Status.Started
            pEmitter.emit('started', plugin)
        }
    }
}

/**
 * Stops a plugin by running its stop lifecycle and cleanup functions.
 */
export async function stopPlugin(plugin: AnyPlugin) {
    requirePluginStartableState(plugin)

    const {
        manifest: { id },
    } = plugin

    const meta = getInternalPluginMeta(plugin)!

    if (isPluginEssential(meta))
        throw new Error(`Plugin "${id}" is essential and cannot be stopped`)

    if (plugin.status & Status.Stopping)
        throw new Error(`Plugin "${id}" is already stopping`)

    const { lifecycles } = plugin
    const { promises, handleError } = meta

    // Wait for in-progress lifecycles to finish or timeout
    if (plugin.status & (Status.PreIniting | Status.Initing | Status.Starting))
        await Promise.race([
            !isPluginErrored(plugin) && Promise.all(promises),
            sleepReject(
                MaxWaitTime,
                'Plugin lifecycles timed out, force stopping',
            ),
        ]).catch(e => {
            plugin.flags |= Flag.PendingReload
            return handlePluginError(e, plugin)
        })
    else if (
        !(plugin.status & (Status.PreInited | Status.Inited | Status.Started))
    )
        throw new Error(`Plugin "${id}" is not running`)

    plugin.status |= Status.Stopping

    try {
        if (lifecycles.stop)
            await Promise.race([
                lifecycles.stop.apply(plugin, [plugin.api as PluginApi]),
                sleepReject(
                    MaxWaitTime,
                    'Plugin stop lifecycle timed out, force stopping',
                ),
            ])
    } catch (e) {
        await handleError(e)
    } finally {
        // Run cleanups
        await cleanupPlugin(plugin, meta)

        // Reset state
        plugin.api = undefined
        meta.apiLevel = PluginApiLevel.None
        meta.promises.length = 0
        meta.cleanups.length = 0
        plugin.status = 0

        pEmitter.emit('stopped', plugin)
    }
}

/**
 * Runs all cleanup functions registered by a plugin.
 */
async function cleanupPlugin(plugin: AnyPlugin, meta: InternalPluginMeta) {
    async function handleStopError(e: unknown) {
        // Some cleanup was unsuccessful, so we need to reload the app
        plugin.flags |= Flag.PendingReload
        return handlePluginError(e, plugin)
    }

    const proms: Promise<any>[] = []

    for (const cleanup of meta.cleanups)
        try {
            proms.push(cleanup())
        } catch (e) {
            await handleStopError(e)
        }

    await Promise.all(proms)
}

export function getInternalPluginMeta(plugin: AnyPlugin): InternalPluginMeta {
    return pMetadata.get(plugin)!
}

export { uninstallExternalPlugin } from './external-plugins'

declare module '@revenge-mod/modules/native' {
    interface Methods {
        'revenge.plugins.loader.start': [[id: PluginManifest['id']], null]
        'revenge.plugins.states.read': [[], PersistedPluginStates | null]
        'revenge.plugins.states.setEnabled': [
            [id: PluginManifest['id'], enabled: boolean],
            null,
        ]
    }
}

interface PluginStateObject {
    enabled?: boolean
    pendingReload?: boolean
    errored?: boolean
    enabledLate?: boolean
}

interface PersistedPluginStates {
    states: {
        [id: PluginManifest['id']]: PluginStateObject
    }
}
