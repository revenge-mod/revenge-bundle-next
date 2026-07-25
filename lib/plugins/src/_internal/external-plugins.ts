import {
    callNativeMethod,
    callNativeMethodSync,
    registerJSMethod,
} from '@revenge-mod/modules/native'
import { getErrorStack } from '@revenge-mod/utils/error'
import { pUnscopedApi } from '../apis'
import {
    disablePlugin,
    getInternalPluginMeta,
    handlePluginError,
    InternalPluginFlags,
    isPluginEnabled,
    PluginFlags,
    pEmitter,
    pList,
    registerInternalPlugin,
    registerPlugin,
    toPluginError,
} from '.'
import { pPending } from './dependency-graph'
import { registerRepositoryEvents } from './repositories'
import type { PluginManifest, PluginOptionsFactory } from '../types'
import type {
    AnyPlugin,
    PluginError,
    PluginInstallReadyEvent,
    PluginSource,
} from '.'

interface ExternalPlugin {
    manifest: PluginManifest
    script?: string
    internal?: boolean
    essential?: boolean
    enabledByDefault?: boolean
    api?: boolean
    /**
     * The plugin failed to load at native boot (session-skip).
     * It is registered so the user sees it and the reasons, but it never runs this session.
     * - Dependency failures keep the enabled flag (auto-recovers next boot once resolved).
     * - Own-fault failures (bad code, bad manifest) arrive already disabled by native.
     */
    failed?: boolean
    /** Where the plugin came from. Missing or `repo: null` means sideloaded. */
    source?: PluginSource | null
    unsatisfiedOptionalDependencies?: string[]
    /** Errors the native side already hit (eg. at boot before JS was up, after faulty update). */
    errors?: PluginError[]
}

type PluginInstallResult =
    | { error: false; plugin: ExternalPlugin }
    | { error: PluginError }

export function registerExternalPlugins() {
    registerJSMethod(
        'revenge.plugins.events.pluginInstallResult',
        async function installedHandler(result: PluginInstallResult) {
            if (result.error !== false) {
                pEmitter.emit('install', { error: result.error })
                return
            }

            // Native only fires this for fresh installs of new IDs
            // Updates go through `pluginUpdated` instead and apply at reload
            const { plugin } = result

            try {
                registerExternalPlugin(plugin)
            } catch (e) {
                pEmitter.emit('install', { error: toPluginError(e) })
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
            // The new version is on disk only, the running plugin keeps its old code until reload
            // PendingUpdate causes the reload alert to show up
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
        'revenge.plugins.events.pluginInstallReady',
        (event: PluginInstallReadyEvent) => {
            pEmitter.emit('installReady', event)
        },
    )

    registerRepositoryEvents()

    const externals = callNativeMethodSync('revenge.plugins.list', [])
    if (!externals) return

    for (const external of externals)
        try {
            // Skip plugins whose JS counterpart is already registered
            if (pList.has(external.manifest.id)) continue
            registerExternalPlugin(external)
        } catch (e) {
            nativeLoggingHook(
                `\u001b[31mFailed to register external plugin "${external.manifest.id}": ${getErrorStack(e)}\u001b[0m`,
                2,
            )
        }
}

export function registerExternalPlugin(external: ExternalPlugin) {
    const {
        manifest,
        script,
        internal,
        essential,
        enabledByDefault,
        api,
        failed,
        source,
        unsatisfiedOptionalDependencies,
        errors,
    } = external

    const id = internal
        ? registerInternalPlugin(
              manifest,
              createOptionsFactory(script),
              essential || enabledByDefault ? PluginFlags.Enabled : 0,
              InternalPluginFlags.Internal |
                  (essential ? InternalPluginFlags.Essential : 0) |
                  (api ? InternalPluginFlags.API : 0),
          )
        : registerPlugin(
              manifest,
              createOptionsFactory(script),
              enabledByDefault ? PluginFlags.Enabled : 0,
          )

    const plugin = pList.get(id)!
    const meta = getInternalPluginMeta(plugin)

    meta.source = source
    if (unsatisfiedOptionalDependencies?.length)
        meta.unsatisfiedOptionalDependencies = Object.freeze(
            unsatisfiedOptionalDependencies,
        )

    /** @see {@link PluginFlags.Failed} */
    if (failed) {
        meta.flags |= PluginFlags.Failed
        pPending.delete(plugin)
    }

    // Sync errors the native side already caught
    if (errors?.length)
        for (const error of errors) handlePluginError(error, plugin)

    return id
}

export async function uninstallExternalPlugin(plugin: AnyPlugin) {
    if (isPluginEnabled(plugin)) await disablePlugin(plugin)

    await callNativeMethod('revenge.plugins.uninstall', [plugin.manifest.id])

    pList.delete(plugin.manifest.id)
    pEmitter.emit('unregister', plugin)
}

export async function resyncPluginSources() {
    const externals = await callNativeMethod('revenge.plugins.list', [])
    if (!externals) return

    for (const external of externals) {
        const plugin = pList.get(external.manifest.id)
        if (!plugin) continue

        const meta = getInternalPluginMeta(plugin)
        meta.source = external.source
        pEmitter.emit('flagUpdate', plugin)
    }
}

export function confirmInstall(
    token: string,
    accepted: boolean,
): Promise<{ result: 'installed' | 'pending' | 'cancelled' }> {
    return callNativeMethod('revenge.plugins.confirmInstall', [token, accepted])
}

function createOptionsFactory(script?: string): PluginOptionsFactory {
    if (!script) return () => ({})
    return () => new Function('revenge', `return ${script}`)(pUnscopedApi)
}

declare module '@revenge-mod/modules/native' {
    interface NativeMethods {
        'revenge.plugins.list': [[], ExternalPlugin[] | null]
        'revenge.plugins.installFile': [[], null]
        'revenge.plugins.uninstall': [[string], null]
        'revenge.plugins.confirmInstall': [
            [token: string, accepted: boolean],
            { result: 'installed' | 'pending' | 'cancelled' },
        ]
    }
}
