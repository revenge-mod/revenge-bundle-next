import { TypedEventEmitter } from '@revenge-mod/discord/common/utils'
import {
    callBridgeMethod,
    callBridgeMethodSync,
} from '@revenge-mod/modules/native'
import { getErrorStack } from '@revenge-mod/utils/error'
import { sleepReject } from '@revenge-mod/utils/promise'
import { pUnscopedApi as uapi } from '../apis'
import {
    PluginFlags as Flag,
    PersistentPluginFlags,
    PluginStatus as Status,
} from '../constants'
import {
    addPluginApiDecorator,
    decoratePluginApi,
    pDecoratorsInit,
    pDecoratorsPreInit,
    pDecoratorsStart,
    pImplicitDeps,
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
    PreInitPluginApi,
} from '../types'

export type AnyPlugin = Plugin<any, any>

const MaxWaitTime = 5000

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
     * Marks the plugin as a dependency of all other plugins.
     */
    ImplicitDependency: 1 << 2,
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
    flags: number
}

export const pUnscopedApi = uapi
export const pEmitter = new TypedEventEmitter<{
    register: [AnyPlugin, PluginOptions<any>, update?: true]
    disabled: [AnyPlugin]
    enabled: [AnyPlugin]
    preInited: [AnyPlugin]
    inited: [AnyPlugin]
    started: [AnyPlugin]
    stopped: [AnyPlugin]
    errored: [AnyPlugin, unknown]
    flagUpdate: [AnyPlugin]
}>()

export const pList = new Map<PluginManifest['id'], AnyPlugin>()
export const pMetadata = new WeakMap<AnyPlugin, InternalPluginMeta>()

const { flags: PersistedFlags }: PersistedPluginStates = callBridgeMethodSync(
    'revenge.plugins.states.read',
    [],
) ?? {
    flags: {},
}

pEmitter.on('flagUpdate', plugin => {
    PersistedFlags[plugin.manifest.id] = plugin.flags & PersistentPluginFlags
    callBridgeMethod('revenge.plugins.states.write', [PersistedFlags])
})

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
    options: PluginOptions<O>,
    defflags: number,
    iflags: number,
) {
    // TODO(plugins): verify plugin manifest
    if (pList.has(manifest.id))
        throw new Error(`Plugin with ID "${manifest.id}" already registered`)

    const plugin = {
        errors: [],
        manifest,
        lifecycles: {
            preInit: options.preInit,
            init: options.init,
            start: options.start,
            stop: options.stop,
        },
        SettingsComponent: options.SettingsComponent,
        status: 0,
        disable: () => disablePlugin(plugin),
        stop: () => stopPlugin(plugin),
        api: undefined,
        set flags(flags: number) {
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
        options,
        flags: PersistedFlags[manifest.id] ?? defflags,
    }

    pMetadata.set(plugin, meta)
    pList.set(manifest.id, plugin)

    if (iflags & InternalPluginFlags.ImplicitDependency) {
        pLeafOrSingleNodes.add(plugin)
        pImplicitDeps.add(plugin)
    }
    // Only add to pending if the plugin is enabled
    else if (isPluginEnabled(plugin)) pPending.add(plugin)

    pEmitter.emit('register', plugin, options)

    return { id: manifest.id } satisfies PluginDependency
}

/**
 * Gets dependencies for a plugin.
 */
export function getPluginDependencies(plugin: AnyPlugin): AnyPlugin[] {
    const meta = pMetadata.get(plugin)!
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

export function isPluginEnabled({ flags }: AnyPlugin): boolean {
    return Boolean(flags & Flag.Enabled)
}

export function isPluginEssential({ iflags }: InternalPluginMeta): boolean {
    return Boolean(iflags & InternalPluginFlags.Essential)
}

export function isPluginInternal({ iflags }: InternalPluginMeta): boolean {
    return Boolean(iflags & InternalPluginFlags.Internal)
}

function guardPluginEnabled(plugin: AnyPlugin) {
    if (!isPluginEnabled(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" is not enabled`)
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

    if (!isPluginEssential(pMetadata.get(plugin)!)) await plugin.disable()
}

/**
 * Prepares the plugin API for the preInit lifecycle.
 */
function tryPreparePluginPreInit(plugin: AnyPlugin) {
    const meta = pMetadata.get(plugin)!
    if (meta.apiLevel >= PluginApiLevel.PreInit) return

    // Clear errors from previous runs
    plugin.errors = []
    plugin.status &= ~Flag.Errored

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
    const meta = pMetadata.get(plugin)!
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
    const meta = pMetadata.get(plugin)!
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
    guardPluginEnabled(plugin)

    const meta = pMetadata.get(plugin)!

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

    plugin.flags |= Flag.Enabled
    pEmitter.emit('enabled', plugin)
}

export async function runPluginLate(plugin: AnyPlugin) {
    guardPluginEnabled(plugin)

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
    guardPluginEnabled(plugin)

    const {
        manifest: { id },
    } = plugin

    if (plugin.status & (Status.PreIniting | Status.PreInited))
        throw new Error(
            `Plugin preInit lifecycle for "${id}" is already running`,
        )

    tryPreparePluginPreInit(plugin)

    const { lifecycles } = plugin
    const { promises, handleError } = pMetadata.get(plugin)!

    try {
        if (!lifecycles.preInit) return

        plugin.status |= Status.PreIniting

        try {
            const prom = lifecycles.preInit(plugin.api as PreInitPluginApi)
            promises.push(prom)
            await prom
        } catch (e) {
            await handleError(e)
        } finally {
            plugin.status |= Status.PreInited
            plugin.status &= ~Status.PreIniting
        }
    } finally {
        pEmitter.emit('preInited', plugin)
    }
}

/**
 * Runs the init lifecycle of a plugin.
 */
export async function initPlugin(plugin: AnyPlugin) {
    guardPluginEnabled(plugin)

    const {
        manifest: { id },
    } = plugin

    const meta = pMetadata.get(plugin)!

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
            const prom = lifecycles.init(plugin.api as InitPluginApi)
            promises.push(prom)
            await prom
        } catch (e) {
            await handleError(e)
        } finally {
            plugin.status |= Status.Inited
            plugin.status &= ~Status.Initing
        }
    } finally {
        pEmitter.emit('inited', plugin)
    }
}

/**
 * Starts a plugin by running its start lifecycle.
 */
export async function startPlugin(plugin: AnyPlugin) {
    guardPluginEnabled(plugin)

    const {
        manifest: { id },
    } = plugin

    if (plugin.status & (Status.Starting | Status.Started))
        throw new Error(`Plugin start lifecycle for "${id}" is already running`)

    tryPreparePluginPreInit(plugin)
    tryPreparePluginInit(plugin)
    tryPreparePluginStart(plugin)

    const { lifecycles } = plugin
    const { promises, handleError } = pMetadata.get(plugin)!

    try {
        if (!lifecycles.start) return

        plugin.status |= Status.Starting

        try {
            const prom = lifecycles.start(plugin.api as PluginApi)
            promises.push(prom)
            await prom
        } catch (e) {
            await handleError(e)
        } finally {
            plugin.status |= Status.Started
            plugin.status &= ~Status.Starting
        }
    } finally {
        pEmitter.emit('started', plugin)
    }
}

/**
 * Stops a plugin by running its stop lifecycle and cleanup functions.
 */
export async function stopPlugin(plugin: AnyPlugin) {
    guardPluginEnabled(plugin)

    const {
        manifest: { id },
    } = plugin

    const meta = pMetadata.get(plugin)!

    if (isPluginEssential(meta))
        throw new Error(`Plugin "${id}" is essential and cannot be stopped`)

    if (plugin.status & Status.Stopping)
        throw new Error(`Plugin "${id}" is already stopping`)

    const { lifecycles } = plugin
    const { promises, handleError } = meta

    // Wait for in-progress lifecycles to finish or timeout
    if (plugin.status & (Status.PreIniting | Status.Initing | Status.Starting))
        await Promise.race([
            Promise.all(promises),
            sleepReject(
                MaxWaitTime,
                'Plugin lifecycles timed out, force stopping',
            ),
        ]).catch(e => {
            plugin.flags |= Flag.ReloadRequired
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
                lifecycles.stop(plugin.api as PluginApi),
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
        plugin.flags |= Flag.ReloadRequired
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

declare module '@revenge-mod/modules/native' {
    interface Methods {
        'revenge.plugins.states.read': [[], PersistedPluginStates | null]
        'revenge.plugins.states.write': [[statuses: PersistedPluginFlags], void]
    }
}

interface PersistedPluginStates {
    flags: PersistedPluginFlags
}

interface PersistedPluginFlags {
    [id: PluginManifest['id']]: number
}
