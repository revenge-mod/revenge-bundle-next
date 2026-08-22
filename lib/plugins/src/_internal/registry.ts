import {
    InternalPluginFlags,
    InternalPluginVersion,
    PluginApiLevel,
    PluginFlags,
} from './constants'
import { pApis } from './decorators'
import {
    ApiDependencyId,
    DiscordDependencyId,
    isReservedDependency,
    pLeafOrSingleNodes,
    pPending,
} from './dependency-graph'
import { pEmitter } from './emitter'
import { disablePlugin, handlePluginError, stopPlugin } from './lifecycles'
import { callPluginSystemMethodSync } from './native'
import { isPluginEnabled, isPluginStartedLate } from './predicates'
import {
    flagsToPluginState,
    InitialPersistedStates,
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
 * @see {@link registerPlugin}
 *
 * @param manifest Partial or complete plugin manifest.
 * @param iflags Internal plugin flags.
 */
export function registerInternalPlugin<O extends PluginApiExtensionsOptions>(
    manifest: InternalPluginManifest,
    options: PluginOptions<O> | PluginOptionsFactory<O>,
    defflags: number,
    iflags = 0,
) {
    manifest.version ??= InternalPluginVersion
    // TODO: This has to be shared from native somehow.
    manifest.format ??= 1

    if (!isReservedDependency(manifest.id)) {
        manifest.dependencies ??= {}
        manifest.dependencies[ApiDependencyId] ??= { version: '*' }
        manifest.dependencies[DiscordDependencyId] ??= { version: '*' }
    }

    return register(manifest as PluginManifest, options, defflags, iflags)
}

function register<O extends PluginApiExtensionsOptions>(
    manifest: PluginManifest,
    options: PluginOptions<O> | PluginOptionsFactory<O>,
    defflags: number,
    iflags: number,
) {
    if (pList.has(manifest.id)) {
        if (!iflags)
            throw new Error(
                `Plugin with ID "${manifest.id}" already registered`,
            )
    }

    const factory = typeof options === 'function' ? options : undefined
    const resolved = typeof options === 'function' ? undefined : options
    const { id } = manifest

    // Store entry must exist before the accessors below are read
    store.addPlugin(
        id,
        InitialPersistedStates[id]
            ? pluginStateToFlags(InitialPersistedStates[id])
            : defflags,
    )

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
        disable: (): Promise<void> => disablePlugin(plugin),
        stop: (): Promise<void> => stopPlugin(plugin),
        reportError: (e: unknown) => handlePluginError(e, plugin, false),
        requireReload: () => {
            meta.flags |= PluginFlags.PendingReload
        },
        api: undefined,
    } satisfies AnyPlugin

    const meta: InternalPluginMeta = {
        cleanups: [],
        nativeErrors: Object.freeze([]),
        promises: [],
        iflags,
        apiLevel: PluginApiLevel.None,
        unsatisfiedOptionalDependencies: Object.freeze([]),
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
            if (flags === store.getSessionFlags(id)) return

            const newState = callPluginSystemMethodSync(
                'revenge.plugins.states.update',
                [id, flagsToPluginState(flags)],
            )

            store.setSessionFlags(id, pluginStateToFlags(newState))

            pEmitter.emit('stateUpdate', plugin)
        },
        get flags() {
            return store.getSessionFlags(id)
        },
    }

    pMetadata.set(plugin, meta)
    pList.set(id, plugin)

    if (iflags & InternalPluginFlags.API) {
        pLeafOrSingleNodes.add(plugin)
        pApis.add(plugin)
    } else if (isPluginEnabled(plugin)) pPending.add(plugin)

    pEmitter.emit('register', plugin, meta.options)

    return manifest.id
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
