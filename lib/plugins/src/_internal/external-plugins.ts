import { registerJSMethod } from '@revenge-mod/modules/native'
import { noop } from '@revenge-mod/utils/callback'
import { getErrorStack } from '@revenge-mod/utils/error'
import {
    disablePluginInActiveSlot,
    forgetBootPluginState,
    getInternalPluginMeta,
    getLinkedOptionalDependents,
    InternalPluginFlags,
    isPluginEnabledInActiveSlot,
    PluginFlags,
    pEmitter,
    pList,
    registerInternalPlugin,
    registerPlugin,
    runPluginLate,
    toPluginSystemErrorPayload,
    unregisterPlugin,
} from '.'
import { pPending } from './dependency-graph'
import { callPluginSystemMethod, callPluginSystemMethodSync } from './native'
import { registerRepositoryEvents, setPluginHeld } from './repositories'
import { createOptionsFactory } from './script'
import type { PluginManifest } from '../types'
import type {
    AnyPlugin,
    PluginInstallReadyEvent,
    PluginSource,
    PluginSystemErrorPayload,
} from '.'

interface ExternalPlugin {
    manifest: PluginManifest
    script?: string
    internal?: boolean
    essential?: boolean
    enabledByDefault?: boolean
    api?: boolean
    /**
     * Session-skipped plugin failing native boot discovery.
     * Registered for UI visibility without executing during active session.
     */
    failed?: boolean
    /** Plugin provenance. Missing or `repo: null` means sideloaded. */
    source?: PluginSource | null
    /** Declared optional dependencies native sees installed at an incompatible version. */
    unsatisfiedOptionalDependencies?: string[]
    /** Native boot and validation errors. */
    errors?: PluginSystemErrorPayload[]
}

type PluginInstallResult =
    | { error: false; plugin: ExternalPlugin }
    | { error: PluginSystemErrorPayload }

/** Registers native event listeners and imports native-discovered plugins. */
export function registerExternalPlugins() {
    registerJSMethod(
        'revenge.plugins.events.pluginInstallResult',
        async function installedHandler(result: PluginInstallResult) {
            if (result.error !== false) {
                pEmitter.emit('install', { error: result.error })
                return
            }

            // Native dispatches fresh installs for new IDs only
            const { plugin } = result

            try {
                // Drop stale boot snapshot entry so fresh install registers disabled
                forgetBootPluginState(plugin.manifest.id)
                registerExternalPlugin(plugin)
            } catch (e) {
                pEmitter.emit('install', {
                    error: toPluginSystemErrorPayload(e),
                })
                return
            }

            pEmitter.emit('install', {
                error: false,
                manifest: plugin.manifest,
                updated: false,
                pending: false,
            })
        },
    )

    registerJSMethod(
        'revenge.plugins.events.pluginUpdated',
        async function updatePendingHandler({
            id,
            version,
        }: {
            id: string
            version: string
        }) {
            // New version exists on disk only; running plugin continues until reload
            const plugin = pList.get(id)
            if (plugin) {
                const meta = getInternalPluginMeta(plugin)
                meta.flags |= PluginFlags.PendingUpdate
            }

            pEmitter.emit('install', {
                error: false,
                pending: true,
                id,
                version,
            })
        },
    )

    registerJSMethod(
        'revenge.plugins.events.pluginInstallFileReady',
        (event: PluginInstallReadyEvent) => {
            pEmitter.emit('installReady', event)
        },
    )

    registerJSMethod(
        'revenge.plugins.events.dependenciesUpdated',
        (update: {
            unsatisfiedOptionalDependencies: Record<
                PluginManifest['id'],
                PluginManifest['id'][]
            >
        }) => {
            if (__DEV__)
                nativeLoggingHook(
                    `\u001b[33mPlugin dependency graph updated: ${JSON.stringify(
                        update,
                    )}\u001b[0m`,
                    1,
                )

            for (const plugin of pList.values()) {
                const deps =
                    update.unsatisfiedOptionalDependencies[plugin.manifest.id]
                if (deps)
                    getInternalPluginMeta(
                        plugin,
                    ).unsatisfiedOptionalDependencies = new Set(deps)
            }
        },
    )

    registerRepositoryEvents()

    const externals = callPluginSystemMethodSync('revenge.plugins.list', [])
    if (!externals) return

    for (const external of externals)
        try {
            const known = pList.get(external.manifest.id)

            // JS internal plugins are already registered before we grab native descriptors
            // so we only apply the descriptors instead of re-registering them.
            if (known) {
                applyNativeDescriptor(known, external)
                continue
            }

            registerExternalPlugin(external)
        } catch (e) {
            nativeLoggingHook(
                `\u001b[31mFailed to register external plugin "${external.manifest.id}": ${getErrorStack(e)}\u001b[0m`,
                2,
            )
        }
}

function applyNativeDescriptor(plugin: AnyPlugin, external: ExternalPlugin) {
    const meta = getInternalPluginMeta(plugin)

    meta.source = external.source
    if (external.unsatisfiedOptionalDependencies)
        meta.unsatisfiedOptionalDependencies = new Set(
            external.unsatisfiedOptionalDependencies,
        )

    /** @see {@link PluginFlags.Failed} */
    if (external.failed) {
        meta.flags |= PluginFlags.Failed
        pPending.delete(plugin)
    }

    if (external.errors?.length)
        meta.nativeErrors = Object.freeze(external.errors)
}

/** Registers external plugin instance from native descriptor. */
export function registerExternalPlugin(external: ExternalPlugin) {
    const { manifest, script, internal, essential, enabledByDefault, api } =
        external

    // JS internal plugins data take priority
    if (internal && pList.has(manifest.id)) {
        applyNativeDescriptor(pList.get(manifest.id)!, external)
        return
    }

    const id = internal
        ? registerInternalPlugin(
              manifest,
              createOptionsFactory(manifest.id, script),
              essential || enabledByDefault ? PluginFlags.Enabled : 0,
              InternalPluginFlags.Internal |
                  (essential ? InternalPluginFlags.Essential : 0) |
                  (api ? InternalPluginFlags.API : 0),
          )
        : registerPlugin(
              manifest,
              createOptionsFactory(manifest.id, script),
              enabledByDefault ? PluginFlags.Enabled : 0,
          )

    applyNativeDescriptor(pList.get(id)!, external)

    return id
}

/** Updates update-hold state for plugin. */
export async function setUpdatesPaused(plugin: AnyPlugin, paused: boolean) {
    const meta = getInternalPluginMeta(plugin)
    const newSource = await setPluginHeld(plugin.manifest.id, paused)
    meta.source = newSource
}

/**
 * Uninstalls an external plugin, removing files, state, and runtime registration.
 *
 * Optional dependents stopped by the disable cascade are restarted. Required dependents stay disabled.
 */
export async function uninstallExternalPlugin(plugin: AnyPlugin) {
    // Read before disabling, which would modify the list.
    const optionals = getLinkedOptionalDependents(plugin)

    if (isPluginEnabledInActiveSlot(plugin))
        await disablePluginInActiveSlot(plugin)

    await callPluginSystemMethod('revenge.plugins.uninstall', [
        plugin.manifest.id,
    ])

    // Native cleared persisted flags, drop the initial snapshot entry
    forgetBootPluginState(plugin.manifest.id)

    unregisterPlugin(plugin)

    // Restart optional dependents that were stopped by cascade.
    await Promise.all(optionals.map(dep => runPluginLate(dep).catch(noop)))
}

/** Resyncs plugin source metadata from native registry. */
export async function resyncPluginSources() {
    const externals = await callPluginSystemMethod('revenge.plugins.list', [])
    if (!externals) return

    for (const external of externals) {
        const plugin = pList.get(external.manifest.id)
        if (!plugin) continue

        const meta = getInternalPluginMeta(plugin)
        meta.source = external.source
        pEmitter.emit('metadataUpdate', plugin)
    }
}

/** Submits user response to staged sideload installation prompt. */
export function confirmInstallFile(
    token: string,
    accepted: boolean,
): Promise<{ result: 'installed' | 'pending' | 'cancelled' }> {
    return callPluginSystemMethod('revenge.plugins.confirmInstallFile', [
        token,
        accepted,
    ])
}

declare module '@revenge-mod/modules/native' {
    interface NativeMethods {
        'revenge.plugins.list': [[], ExternalPlugin[] | null]
        'revenge.plugins.uninstall': [[string], null]
        'revenge.plugins.installFile': [[], null]
        'revenge.plugins.confirmInstallFile': [
            [token: string, accepted: boolean],
            { result: 'installed' | 'pending' | 'cancelled' },
        ]
    }
}
