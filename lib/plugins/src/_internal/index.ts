import { TypedEventEmitter } from '@revenge-mod/discord/common/utils'
import {
    callNativeMethod,
    callNativeMethodSync,
    registerJSMethod,
} from '@revenge-mod/modules/native'
import { exists, rm } from '@revenge-mod/modules/native/fs'
import { getErrorStack } from '@revenge-mod/utils/error'
import { sleepReject } from '@revenge-mod/utils/promise'
import { pUnscopedApi as uapi } from '../apis'
import { pluginStorageDirFor, PluginStatus as Status } from '../constants'
import {
    addPluginApiDecorator,
    decoratePluginApi,
    pApis,
    pDecoratorsInit,
    pDecoratorsPreInit,
    pDecoratorsStart,
} from './decorators'
import {
    ApiDependencyId,
    computePendingNodes,
    DiscordDependencyId,
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
    PluginManifest,
    PluginOptions,
    PluginOptionsFactory,
    PluginVersion,
    PreInitPluginApi,
} from '../types'

export type AnyPlugin = Plugin<any, any>

const InternalPluginVersion: PluginVersion = (() => {
    const [segments, label] = __BUILD_VERSION__.split('-')
    const nums = segments.split('.').map(Number)
    if (!label) return { nums }
    return { nums, label }
})()

const MaxWaitTime = 5000

export const PluginFlags = {
    Enabled: 1 << 0,
    PendingReload: 1 << 1,
    StartedLate: 1 << 2,
    /**
     * A newer version of the plugin is on disk, but the running version is still active.
     * The new plugin version will be reloaded on next reload.
     *
     * This flag is JS-side.
     */
    PendingUpdate: 1 << 3,
    /**
     * The plugin failed to load this session (aka. session-skip), but is registered so the user sees it and the reason.
     * It can never run in this session, and it isn't disabled however.
     *
     * This is usually because some dependencies failed to start, but could be caused by other misc errors too,
     * such as missing dependencies, bad code, etc.
     *
     * This flag is JS-side.
     */
    Failed: 1 << 4,
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
    unsatisfiedOptionalDependencies: readonly string[]
    options: PluginOptions<any>
    optionsFactory?: PluginOptionsFactory<any>
    flags: number
    nativeErrors: readonly PluginError[]
    /**
     * Where the plugin came from. `repo: null` or missing means sideloaded.
     * Internal plugins never have one.
     */
    source?: PluginSource | null
}

export interface PluginSource {
    // url
    repo: string | null
    channel: string
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
    installReady: [PluginInstallReadyEvent]
}>()

/**
 * A sideloaded plugin was staged and validated.
 * The user can confirm (or declines) through `confirmInstall(token, accepted)`.
 */
export interface PluginInstallReadyEvent {
    /** Single-use confirmation token. */
    token: string
    manifest: {
        id: string
        name: string
        description: string
        author: string
        version: string
        icon?: string | null
    }
    /** The installed version this replaces, or null for a fresh install. */
    replaces: string | null
}

export type PluginInstallEvent =
    | {
          error: false
          manifest: PluginManifest
          updated: boolean
          pending: false
      }
    | {
          /**
           * The plugin was applied on disk only. The running version, if any, is
           * untouched and the new one loads at next reload.
           */
          error: false
          pending: true
          id: string
          version: string
      }
    | { error: PluginError }

/// PLUGIN ERRORS

export interface PluginError {
    /** One of {@link PluginErrorCodes}, or something unknown. */
    code: string
    message: string
    stack?: string | null
}

export const PluginErrorCodes = {
    // Discovery / boot
    ManifestInvalid: 'MANIFEST_INVALID',
    DependencyMissing: 'DEPENDENCY_MISSING',
    DependencyUnsatisfied: 'DEPENDENCY_UNSATISFIED',
    DependencyFailed: 'DEPENDENCY_FAILED',
    DependencyCycle: 'DEPENDENCY_CYCLE',
    LoadFailed: 'LOAD_FAILED',

    /* The plugin's own code threw */
    PluginError: 'PLUGIN_ERROR',

    InstallInvalidZip: 'INSTALL_INVALID_ZIP',
    InstallVerifyFailed: 'INSTALL_VERIFY_FAILED',
    InstallMismatch: 'INSTALL_MISMATCH',
    InstallFailed: 'INSTALL_FAILED',
} as const

export function isPluginError(e: unknown): e is PluginError {
    return (
        typeof e === 'object' &&
        e !== null &&
        typeof (e as PluginError).code === 'string' &&
        typeof (e as PluginError).message === 'string'
    )
}

export function toPluginError(e: unknown): PluginError {
    if (isPluginError(e)) return e
    if (e instanceof Error)
        return {
            code: PluginErrorCodes.PluginError,
            message: e.message,
            stack: e.stack,
        }
    return { code: PluginErrorCodes.PluginError, message: String(e) }
}

export function formatPluginError(e: unknown): string {
    const err = toPluginError(e)
    return `[${err.code}] ${err.message}${err.stack ? `\n${err.stack}` : ''}`
}

export const pList = new Map<PluginManifest['id'], AnyPlugin>()
const pMetadata = new WeakMap<AnyPlugin, InternalPluginMeta>()

/// STATE-SYNC

const { states: InitialPersistedStates, savedStates }: PersistedPluginStates =
    callNativeMethodSync('revenge.plugins.states.read', [])

/**
 * Whether this boot is running with default plugins only, ignoring the user's saved states.
 */
export const isDefaultsOnlyBoot = savedStates != null

/**
 * The user's real saved states, only sent when this boot ignores them (recovery/defaults-only).
 *
 * @see {@link isDefaultsOnlyBoot}
 */
export const SavedPluginStates = savedStates ?? null

/**
 * Whether a plugin is enabled in the user's saved setup, which in a defaults-only boot is not
 * what's running. Falls back to the session state on a normal boot.
 */
export function isPluginEnabledInSavedStates(plugin: AnyPlugin): boolean {
    const saved = SavedPluginStates?.[plugin.manifest.id]
    return saved ? Boolean(saved.enabled) : isPluginEnabled(plugin)
}

export function forgetInitialPluginState(id: PluginManifest['id']) {
    delete InitialPersistedStates[id]
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
        (state.enabledLate || state.startedLate ? Flag.StartedLate : 0)
    )
}

async function applyPluginFlags(id: PluginManifest['id'], flags: number) {
    const plugin = pList.get(id)
    if (!plugin) return

    const meta = getInternalPluginMeta(plugin)
    // Repersist JS-side flags
    flags |= meta.flags & (Flag.PendingUpdate | Flag.Failed)
    if (meta.flags === flags) return

    const wasEnabled = meta.flags & Flag.Enabled
    const nowEnabled = flags & Flag.Enabled

    if (wasEnabled && !nowEnabled) {
        if (plugin.status && !(plugin.status & Status.Stopping))
            await stopPlugin(plugin)
        meta.flags = flags
        pEmitter.emit('disabled', plugin)
    } else {
        meta.flags = flags
        if (!wasEnabled && nowEnabled) pEmitter.emit('enabled', plugin)
    }
}

/// NATIVE-ERROR SYNC

registerJSMethod(
    'revenge.plugins.events.pluginErrored',
    (id: string, errors: PluginError[]) => {
        const plugin = pList.get(id)
        if (!plugin) return

        const meta = getInternalPluginMeta(plugin)
        meta.nativeErrors = Object.freeze(errors)
        // TODO: Do we need an errored event specifically?
        // Nudge open UI to re-render the errors row
        pEmitter.emit('flagUpdate', plugin)
    },
)

/// REST OF THE SYSTEM

/**
 * Registers a new plugin with the system.
 *
 * @param manifest The manifest of the plugin.
 * @param options The options for the plugin.
 * @param defflags The default flags for the plugin.
 */
export function registerPlugin<O extends PluginApiExtensionsOptions>(
    manifest: PluginManifest,
    options: PluginOptions<O> | PluginOptionsFactory<O>,
    defflags: number,
) {
    return register(manifest, options, defflags, 0)
}

export type InternalPluginManifest = Omit<
    PluginManifest,
    'version' | 'format' | 'dependencies'
> &
    Partial<Pick<PluginManifest, 'version' | 'format' | 'dependencies'>>

export function registerInternalPlugin<O extends PluginApiExtensionsOptions>(
    manifest: InternalPluginManifest,
    options: PluginOptions<O> | PluginOptionsFactory<O>,
    defflags: number,
    iflags = 0,
) {
    manifest.version ??= InternalPluginVersion
    manifest.format ??= 1
    manifest.dependencies ??= {}
    manifest.dependencies[ApiDependencyId] ??= { version: '*' }
    manifest.dependencies[DiscordDependencyId] ??= { version: '*' }

    return register(manifest as PluginManifest, options, defflags, iflags)
}

function register<O extends PluginApiExtensionsOptions>(
    manifest: PluginManifest,
    options: PluginOptions<O> | PluginOptionsFactory<O>,
    defflags: number,
    iflags: number,
) {
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
        get startedLate(): boolean {
            return isPluginStartedLate(plugin)
        },
        disable: (): Promise<void> => disablePlugin(plugin),
        stop: (): Promise<void> => stopPlugin(plugin),
        reportError: (e: unknown) => handlePluginError(e, plugin),
        requireReload: () => {
            meta.flags |= Flag.PendingReload
        },
        api: undefined,
    } satisfies AnyPlugin

    let flags = InitialPersistedStates[manifest.id]
        ? pluginStateToFlags(InitialPersistedStates[manifest.id])
        : defflags

    const meta: InternalPluginMeta = {
        cleanups: [],
        nativeErrors: Object.freeze([]),
        promises: [],
        iflags,
        apiLevel: PluginApiLevel.None,
        unsatisfiedOptionalDependencies: Object.freeze([]),
        handleError: e => handlePluginError(e, plugin),
        options: resolved ?? {},
        optionsFactory: factory,
        set flags(newFlags: number) {
            if (newFlags === flags) return
            flags = newFlags
            pEmitter.emit('flagUpdate', plugin)
        },
        get flags() {
            return flags
        },
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

    return manifest.id
}

export function getPluginDependencies(
    plugin: AnyPlugin,
    throwOnMissing = true,
): AnyPlugin[] {
    const { dependencies, id } = plugin.manifest
    const deps: AnyPlugin[] = []
    const { unsatisfiedOptionalDependencies } = getInternalPluginMeta(plugin)

    if (dependencies)
        for (const [depId, spec] of Object.entries(dependencies)) {
            const dep = pList.get(depId)

            if (dep) {
                if (
                    !spec.optional ||
                    (isPluginEnabled(dep) &&
                        !unsatisfiedOptionalDependencies.includes(depId))
                )
                    deps.push(dep)
            } else if (!spec.optional) {
                if (throwOnMissing) {
                    throw new Error(
                        `Plugin "${id}" depends on unregistered plugin "${depId}"`,
                    )
                }
            }
        }

    return deps
}

export function getMissingPluginDependencies(plugin: AnyPlugin): string[] {
    const { dependencies } = plugin.manifest
    if (!dependencies) return []

    const missing: string[] = []
    for (const [depId, spec] of Object.entries(dependencies)) {
        if (!spec.optional && !pList.has(depId)) missing.push(depId)
    }
    return missing
}

export function getPluginDependents(
    plugin: AnyPlugin,
    includeLinkedOptionals = false,
): AnyPlugin[] {
    const { id } = plugin.manifest
    const dependents: AnyPlugin[] = []
    const enabled = isPluginEnabled(plugin)

    for (const p of pList.values()) {
        const spec = p.manifest.dependencies?.[id]
        if (!spec) continue

        if (!spec.optional) dependents.push(p)
        else if (
            includeLinkedOptionals &&
            enabled &&
            !getInternalPluginMeta(p).unsatisfiedOptionalDependencies.includes(
                id,
            )
        )
            dependents.push(p)
    }

    return dependents
}

export function isPluginEnabled(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return Boolean(meta && meta.flags & Flag.Enabled)
}

export function isPluginStartedLate(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return Boolean(meta && meta.flags & Flag.StartedLate)
}

export function isPluginEssential({ iflags }: InternalPluginMeta): boolean {
    return Boolean(iflags & InternalPluginFlags.Essential)
}

export function isPluginInternal({ iflags }: InternalPluginMeta): boolean {
    return Boolean(iflags & InternalPluginFlags.Internal)
}

export function isPluginErrored(plugin: AnyPlugin): boolean {
    return plugin.errors.length > 0
}

export function isPluginPendingReload(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return Boolean(meta && meta.flags & Flag.PendingReload)
}

export function isPluginPendingUpdate(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return Boolean(meta && meta.flags & Flag.PendingUpdate)
}

/** @see {@link Flag.Failed} */
export function isPluginFailed(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return Boolean(meta && meta.flags & Flag.Failed)
}

/**
 * Requires that the plugin can be started: enabled, not pending a reload, and not failed at discovery.
 * PendingUpdate doesn't block, it only means a newer version sits on disk for next reload.
 */
function requirePluginStartableState(plugin: AnyPlugin) {
    if (!isPluginEnabled(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" is not enabled`)

    if (isPluginPendingReload(plugin))
        throw new Error(
            `Plugin "${plugin.manifest.id}" requires a reload before it can be started again`,
        )

    if (isPluginFailed(plugin))
        throw new Error(
            `Plugin "${plugin.manifest.id}" failed to load this session (reload to retry)`,
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
export async function handlePluginError(e: unknown, plugin: AnyPlugin) {
    ;(plugin.errors as unknown[]).push(e)

    // TODO: Emit errored event so UI can update?
    // Update: errored event removed (but status changes are still emitted), so UI should update fine

    nativeLoggingHook(
        `\u001b[31mPlugin "${plugin.manifest.id}" encountered an error: ${
            isPluginError(e) ? formatPluginError(e) : getErrorStack(e)
        }\u001b[0m`,
        2,
    )

    plugin.api?.logger?.error('Plugin encountered an error', e)

    if (
        !isPluginEssential(getInternalPluginMeta(plugin)) &&
        // Failed plugins keep their persisted enabled state untouched, recovering on a later boot
        !isPluginFailed(plugin) &&
        // Multiple errors may surface, but we only want to disable the plugin once
        isPluginEnabled(plugin)
    )
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
    const meta = getInternalPluginMeta(plugin)
    if (meta.apiLevel >= PluginApiLevel.PreInit) return

    // Clear errors from previous runs
    plugin.errors = []

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
    const meta = getInternalPluginMeta(plugin)
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
    const meta = getInternalPluginMeta(plugin)
    if (meta.apiLevel >= PluginApiLevel.Start) return

    const api = plugin.api as PluginApi

    api.decorate = decorator => {
        addPluginApiDecorator(pDecoratorsStart, plugin, decorator)
    }

    decoratePluginApi(pDecoratorsStart, plugin, meta)
    meta.apiLevel = PluginApiLevel.Start
}

/**
 * Writes the enabled state of a plugin to the native side, and updates the real saved states.
 */
async function writePluginEnabledState(plugin: AnyPlugin, enabled: boolean) {
    const result = await callNativeMethod('revenge.plugins.setEnabled', [
        plugin.manifest.id,
        enabled,
    ])

    if (result?.code === 'DEPENDENCIES_UNSATISFIED') {
        const details = result.problems
            .map(
                p =>
                    `"${p.id}" (requires ${p.required}, installed: ${p.installed ?? 'none'}${p.installed && !p.enabled ? ', disabled' : ''})`,
            )
            .join(', ')

        throw new Error(
            `Cannot enable plugin "${plugin.manifest.id}": unsatisfied dependencies: ${details}`,
        )
    }

    if (SavedPluginStates)
        SavedPluginStates[plugin.manifest.id] = {
            ...SavedPluginStates[plugin.manifest.id],
            enabled,
        }
}

/**
 * Disables a plugin, as well as all its dependents.
 */
export async function disablePlugin(plugin: AnyPlugin) {
    // PendingReload/PendingUpdate never block disabling
    if (!isPluginEnabledInSavedStates(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" is not enabled`)

    const meta = getInternalPluginMeta(plugin)

    if (isPluginEssential(meta))
        throw new Error(
            `Plugin "${plugin.manifest.id}" is essential and cannot be disabled`,
        )

    // Disable dependents
    await Promise.all(
        getPluginDependents(plugin).map(dep => {
            if (getInternalPluginMeta(dep)!.flags & Flag.Enabled)
                return disablePlugin(dep)
        }),
    )

    // Stop the plugin if needed
    if (plugin.status && !(plugin.status & Status.Stopping))
        await stopPlugin(plugin)

    await writePluginEnabledState(plugin, false)

    meta.flags &= ~Flag.Enabled
    pEmitter.emit('disabled', plugin)
}

/**
 * Enables a plugin, as well as all its dependencies.
 */
export async function enablePlugin(plugin: AnyPlugin) {
    if (isPluginEnabledInSavedStates(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" is already enabled`)

    await Promise.all(
        getPluginDependencies(plugin).map(dep => {
            if (!isPluginEnabledInSavedStates(dep)) return enablePlugin(dep)
        }),
    )

    await writePluginEnabledState(plugin, true)

    const meta = getInternalPluginMeta(plugin)
    meta.flags |= Flag.Enabled

    pEmitter.emit('enabled', plugin)
}

export async function runPluginLate(plugin: AnyPlugin) {
    if (isDefaultsOnlyBoot)
        throw new Error(
            `Cannot start plugin "${plugin.manifest.id}" while running with default plugins. Reload to apply your changes.`,
        )

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
                const meta = getInternalPluginMeta(plugin)
                meta.flags |= Flag.StartedLate

                // Plugin would already be started native-side if it was not started late
                // But on late starts (enable, fresh install), we must start the native side too
                await callNativeMethod('revenge.plugins.startNative', [
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
    const { promises, handleError } = getInternalPluginMeta(plugin)

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
    const { promises, handleError } = getInternalPluginMeta(plugin)

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
    // PendingReload/PendingUpdate shouldn't block stopping
    if (!isPluginEnabled(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" is not enabled`)

    const {
        manifest: { id },
    } = plugin

    const meta = getInternalPluginMeta(plugin)

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
            meta.flags |= Flag.PendingReload
            return handlePluginError(e, plugin)
        })
    else if (
        !(plugin.status & (Status.PreInited | Status.Inited | Status.Started))
    )
        throw new Error(`Plugin "${id}" is not running`)

    // Stop dependents
    await Promise.all(
        getPluginDependents(plugin, true).map(dep =>
            dep.status && !(dep.status & Status.Stopping)
                ? stopPlugin(dep)
                : undefined,
        ),
    )

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
        meta.flags |= Flag.PendingReload
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
    const meta = pMetadata.get(plugin)
    if (!meta)
        throw new Error(
            `Plugin "${plugin.manifest.id}" has no internal metadata, is it registered?`,
        )

    return meta
}

export async function deleteStorageForPlugin(plugin: Plugin<any, any>) {
    const dir = pluginStorageDirFor(plugin.manifest.id)

    if (await exists(dir)) await rm(dir)
}

export function requestNextBootDefaultsOnly() {
    callNativeMethodSync(
        'revenge.plugins.states.requestNextBootDefaultsOnly',
        [],
    )
}

export {
    confirmInstall,
    resyncPluginSources,
    uninstallExternalPlugin,
} from './external-plugins'

declare module '@revenge-mod/modules/native' {
    interface NativeMethods {
        'revenge.plugins.startNative': [[id: PluginManifest['id']], null]
        'revenge.plugins.states.read': [[], PersistedPluginStates]
        'revenge.plugins.states.requestNextBootDefaultsOnly': [[], void]
        'revenge.plugins.setEnabled': [
            [id: PluginManifest['id'], enabled: boolean],
            SetEnabledError | null,
        ]
    }
}

type SetEnabledError = {
    code: 'DEPENDENCIES_UNSATISFIED'
    problems: Array<{
        id: PluginManifest['id']
        /** The declared range (`*` for any). */
        required: string
        /** Installed version, or `null` when missing entirely. */
        installed: string | null
        enabled: boolean
    }>
}

interface PluginStateObject {
    enabled?: boolean
    pendingReload?: boolean
    errored?: boolean
    /** @deprecated TODO: (2026-07-26) Remove this in a month's time. */
    enabledLate?: boolean
    startedLate?: boolean
}

interface PersistedPluginStates {
    states: {
        [id: PluginManifest['id']]: PluginStateObject
    }
    savedStates?: {
        [id: PluginManifest['id']]: PluginStateObject
    }
}
