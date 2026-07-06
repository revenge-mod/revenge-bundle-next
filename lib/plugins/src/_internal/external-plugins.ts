import {
    callBridgeMethod,
    callBridgeMethodSync,
    registerJSMethod,
} from '@revenge-mod/modules/native'
import { getErrorStack } from '@revenge-mod/utils/error'
import { pUnscopedApi } from '../apis'
import {
    disablePlugin,
    InternalPluginFlags,
    isPluginEnabled,
    PluginFlags,
    pEmitter,
    pList,
    registerPlugin,
    runPluginLate,
} from '.'
import type { PluginManifest, PluginOptionsFactory } from '../types'
import type { AnyPlugin } from '.'

interface ExternalPlugin {
    manifest: PluginManifest
    script?: string
    internal?: boolean
    essential?: boolean
    enabledByDefault?: boolean
}

export function registerExternalPlugins() {
    registerJSMethod(
        'revenge.plugins.loader.pluginInstalled',
        (external: ExternalPlugin) => {
            loadExternalPlugin(external)
        },
    )

    const externals = callBridgeMethodSync(
        'revenge.plugins.loader.getPlugins',
        [],
    )
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

export function registerExternalPlugin({
    manifest,
    script,
    internal,
    essential,
    enabledByDefault,
}: ExternalPlugin) {
    return registerPlugin(
        manifest,
        createOptionsFactory(script),
        essential || enabledByDefault ? PluginFlags.Enabled : 0,
        (internal ? InternalPluginFlags.Internal : 0) |
            (essential ? InternalPluginFlags.Essential : 0),
    )
}

export async function loadExternalPlugin(external: ExternalPlugin) {
    const { id } = registerExternalPlugin(external)
    const plugin = pList.get(id)

    if (plugin && isPluginEnabled(plugin)) await runPluginLate(plugin)
}

export async function uninstallExternalPlugin(plugin: AnyPlugin) {
    if (isPluginEnabled(plugin)) await disablePlugin(plugin)

    callBridgeMethod('revenge.plugins.loader.uninstallPlugin', [
        plugin.manifest.id,
    ])

    pList.delete(plugin.manifest.id)
    pEmitter.emit('unregister', plugin)
}

function createOptionsFactory(script?: string): PluginOptionsFactory {
    if (!script) return () => ({})
    return () => new Function('revenge', `return ${script}`)(pUnscopedApi)
}

declare module '@revenge-mod/modules/native' {
    interface Methods {
        'revenge.plugins.loader.getPlugins': [[], ExternalPlugin[] | null]
        'revenge.plugins.loader.installPlugin': [[], null]
        'revenge.plugins.loader.uninstallPlugin': [[string], null]
    }
}
