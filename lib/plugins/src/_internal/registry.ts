import {
    InternalPluginFlags,
    InternalPluginVersion,
    PluginApiLevel,
    PluginFlags,
} from './constants'
import { pApis } from './decorators'
import { pLeafOrSingleNodes, pPending } from './dependency-graph'
import { pEmitter } from './emitter'
import {
    disablePluginInActiveSlot,
    handlePluginError,
    stopPlugin,
} from './lifecycles'
import { completeInternalManifest, isEnabledByDefault } from './manifest'
import { callPluginSystemMethodSync } from './native'
import { isPluginEnabled, isPluginStartedLate } from './predicates'
import {
    applySlotFlags,
    BootSlot,
    flagsToPluginState,
    pluginStateToFlags,
} from './state'
import * as store from './store'
import type {
    PluginApiExtensionsOptions,
    PluginManifest,
    PluginOptions,
    PluginOptionsFactory,
} from '../types'
import type {
    AnyPlugin,
    InternalPluginManifest,
    InternalPluginMeta,
} from './types'

export const pList = new Map<PluginManifest['id'], AnyPlugin>()

const pMetadata = new WeakMap<AnyPlugin, InternalPluginMeta>()

/**
 * Registers a plugin.
 *
 * @param manifest Plugin manifest.
 * @param options Plugin options or deferred factory.
 * @param defflags Default flags applied when persisted state is absent.
 */
export function registerPlugin<O extends PluginApiExtensionsOptions>(
    manifest: PluginManifest,
    options: PluginOptions<O> | PluginOptionsFactory<O>,
    defflags: number,
) {
    return register(manifest, options, defflags, 0)
}

/**
 * Registers an internal plugin.
 * If not passed, version, manifest format, and reserved dependencies are filled automatically.
 *
 * The manifest has usually been registered already by {@link registerInternalManifest} at pre-init,
 * in which case this attaches the implementation to the same instance rather than creating a new one.
 *
 * @see {@link registerPlugin}
 *
 * @param manifest Partial or complete plugin manifest.
 * @param defflags Defaults to what the manifest declares.
 * @param iflags Defaults to what the manifest declares.
 */
export function registerInternalPlugin<O extends PluginApiExtensionsOptions>(
    manifest: InternalPluginManifest,
    options: PluginOptions<O> | PluginOptionsFactory<O>,
    defflags = defaultFlagsOf(manifest),
    iflags = internalFlagsOf(manifest),
) {
    return register(
        completeInternalManifest(manifest, InternalPluginVersion),
        options,
        defflags,
        iflags,
    )
}

function defaultFlagsOf(manifest: InternalPluginManifest): number {
    return isEnabledByDefault(manifest) ? PluginFlags.Enabled : 0
}

function internalFlagsOf(manifest: InternalPluginManifest): number {
    return (
        InternalPluginFlags.Internal |
        (manifest.essential ? InternalPluginFlags.Essential : 0) |
        (manifest.api ? InternalPluginFlags.API : 0)
    )
}

/**
 * Registers an internal plugin's manifest without its implementation.
 *
 * The plugin cannot run until its implementation is registered via {@link registerInternalPlugin}.
 */
export function registerInternalManifest(manifest: InternalPluginManifest) {
    const defflags = defaultFlagsOf(manifest)
    const iflags = internalFlagsOf(manifest)
    const completed = completeInternalManifest(manifest, InternalPluginVersion)
    const { id } = completed

    if (pList.has(id))
        throw new Error(`Plugin with ID "${id}" already registered`)

    // Cannot run until the implementation is attached.
    return create(completed, undefined, defflags, iflags, false)
}

function register<O extends PluginApiExtensionsOptions>(
    manifest: PluginManifest,
    options: PluginOptions<O> | PluginOptionsFactory<O>,
    defflags: number,
    iflags: number,
) {
    const existing = pList.get(manifest.id)
    if (existing) {
        const meta = getInternalPluginMeta(existing)!
        if (meta.attached)
            throw new Error(`Plugin "${manifest.id}" already attached`)

        if (!(iflags & InternalPluginFlags.Internal))
            throw new Error(
                `Plugin "${manifest.id}" is already registered as an internal plugin`,
            )

        return attach(existing, meta, options)
    }

    return create(manifest, options, defflags, iflags, true)
}

function attach<O extends PluginApiExtensionsOptions>(
    plugin: AnyPlugin,
    meta: InternalPluginMeta,
    options: PluginOptions<O> | PluginOptionsFactory<O>,
) {
    const { id } = plugin.manifest
    const resolved = typeof options === 'function' ? undefined : options

    plugin.lifecycles.preInit = resolved?.preInit
    plugin.lifecycles.init = resolved?.init
    plugin.lifecycles.start = resolved?.start
    plugin.lifecycles.stop = resolved?.stop
    plugin.SettingsComponent = resolved?.SettingsComponent

    meta.options = resolved ?? {}
    meta.optionsFactory = typeof options === 'function' ? options : undefined
    meta.attached = true

    index(plugin, meta)

    return id
}

function create<O extends PluginApiExtensionsOptions>(
    manifest: PluginManifest,
    options: PluginOptions<O> | PluginOptionsFactory<O> | undefined,
    defflags: number,
    iflags: number,
    attached: boolean,
) {
    const factory = typeof options === 'function' ? options : undefined
    const resolved = typeof options === 'function' ? undefined : options
    const { id } = manifest

    // Store entry must exist before the accessors below are read
    store.addPlugin(id, defflags)

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
        get startedLate(): boolean {
            return isPluginStartedLate(plugin)
        },
        disable: (): Promise<void> => disablePluginInActiveSlot(plugin),
        stop: (): Promise<void> => stopPlugin(plugin),
        reportError: (e: unknown) => handlePluginError(e, plugin, false),
        requireReload: () => {
            meta.flags |= PluginFlags.PendingReload
        },
        api: undefined,
    } satisfies AnyPlugin

    const meta: InternalPluginMeta = {
        attached,
        cleanups: [],
        nativeErrors: Object.freeze([]),
        promises: [],
        iflags,
        apiLevel: PluginApiLevel.None,
        unsatisfiedOptionalDependencies: new Set<string>(),
        linkedDependencies: new Set(),
        handleError: e => handlePluginError(e, plugin, true),
        options: resolved ?? {},
        optionsFactory: factory,
        get status(): number {
            return store.getStatus(id)
        },
        set status(status: number) {
            store.setStatus(id, status)
            pEmitter.emit('statusUpdate', plugin)
        },
        set flags(flags: number) {
            if (flags === store.getFlags(BootSlot, id)) return

            const newState = callPluginSystemMethodSync(
                'revenge.plugins.states.update',
                [BootSlot, id, flagsToPluginState(flags)],
            )

            applySlotFlags(BootSlot, id, pluginStateToFlags(newState))
        },
        get flags() {
            return store.getFlags(BootSlot, id)
        },
    }

    pMetadata.set(plugin, meta)
    pList.set(id, plugin)

    if (attached) index(plugin, meta)

    return id
}

function index(plugin: AnyPlugin, meta: InternalPluginMeta) {
    if (meta.iflags & InternalPluginFlags.API) {
        pLeafOrSingleNodes.add(plugin)
        pApis.add(plugin)
    } else if (isPluginEnabled(plugin)) pPending.add(plugin)

    pEmitter.emit('register', plugin, meta.options)
}

export function unregisterPlugin(plugin: AnyPlugin) {
    pList.delete(plugin.manifest.id)
    store.removePlugin(plugin.manifest.id)
    pEmitter.emit('unregister', plugin)
}

/** Internal metadata for registered plugin. Throws when unregistered. */
export function getInternalPluginMeta(plugin: AnyPlugin): InternalPluginMeta {
    const meta = pMetadata.get(plugin)
    if (!meta)
        throw new Error(
            `Plugin "${plugin.manifest.id}" has no internal metadata, is it registered?`,
        )

    return meta
}
