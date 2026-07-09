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
    isPluginPendingReload,
    PluginFlags,
    pEmitter,
    pList,
    registerPlugin,
    runPluginLate,
    stopPlugin,
} from '.'
import type { PluginManifest, PluginOptionsFactory } from '../types'
import type { AnyPlugin } from '.'

interface ExternalPlugin {
    manifest: PluginManifest
    script?: string
    internal?: boolean
    essential?: boolean
    enabledByDefault?: boolean
    /** Errors the native side already hit (eg. at boot before JS was up, after faulty update). */
    errors?: string[]
}

type PluginInstallResult =
    | { error: false; plugin: ExternalPlugin }
    | { error: string }

export function registerExternalPlugins() {
    registerJSMethod(
        'revenge.plugins.stop',
        async function stopHandler(id: string) {
            const plugin = pList.get(id)
            if (plugin?.status) await stopPlugin(plugin)
        },
    )

    registerJSMethod(
        'revenge.plugins.events.pluginInstalled',
        async function installedHandler(result: PluginInstallResult) {
            if (result.error !== false) {
                pEmitter.emit('install', { error: result.error })
                return
            }

            const { plugin } = result
            const existing = pList.get(plugin.manifest.id)

            try {
                if (existing?.status) {
                    // Should already be stopped by this point, but just in case the native side didn't await
                    await stopPlugin(existing)
                }

                const pendingReload =
                    existing !== undefined && isPluginPendingReload(existing)

                if (existing) pList.delete(plugin.manifest.id)

                if (pendingReload) {
                    // Since reload is required to (un)apply changes, we don't load the new plugin yet
                    // We'll do the next time the app is started
                    const registered = pList.get(
                        registerExternalPlugin(plugin).id,
                    )!

                    const meta = getInternalPluginMeta(registered)
                    meta.flags |= PluginFlags.PendingUpdate
                } else await loadExternalPlugin(plugin)
            } catch (e) {
                pEmitter.emit('install', { error: getErrorStack(e) })
                return
            }

            pEmitter.emit('install', {
                error: false,
                manifest: plugin.manifest,
                updated: existing !== undefined,
            })
        },
    )

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
    const { manifest, script, internal, essential, enabledByDefault, errors } =
        external

    const dep = registerPlugin(
        manifest,
        createOptionsFactory(script),
        essential || enabledByDefault ? PluginFlags.Enabled : 0,
        (internal ? InternalPluginFlags.Internal : 0) |
            (essential ? InternalPluginFlags.Essential : 0),
    )

    // Sync errors the native side already caught
    if (errors?.length) {
        const plugin = pList.get(dep.id)!
        for (const error of errors) handlePluginError(error, plugin)
    }

    return dep
}

export async function loadExternalPlugin(external: ExternalPlugin) {
    const { id } = registerExternalPlugin(external)
    const plugin = pList.get(id)

    if (plugin && isPluginEnabled(plugin)) await runPluginLate(plugin)
}

export async function uninstallExternalPlugin(plugin: AnyPlugin) {
    if (isPluginEnabled(plugin)) await disablePlugin(plugin)

    await callNativeMethod('revenge.plugins.uninstall', [plugin.manifest.id])

    pList.delete(plugin.manifest.id)
    pEmitter.emit('unregister', plugin)
}

function createOptionsFactory(script?: string): PluginOptionsFactory {
    if (!script) return () => ({})
    return () => new Function('revenge', `return ${script}`)(pUnscopedApi)
}

declare module '@revenge-mod/modules/native' {
    interface NativeMethods {
        'revenge.plugins.list': [[], ExternalPlugin[] | null]
        'revenge.plugins.install': [[], null]
        'revenge.plugins.uninstall': [[string], null]
    }
}
