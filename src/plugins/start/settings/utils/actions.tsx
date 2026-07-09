import {
    disablePlugin,
    enablePlugin,
    getInternalPluginMeta,
    getPluginDependencies,
    isPluginEnabled,
    runPluginLate,
} from '@revenge-mod/plugins/_'
import {
    showPluginHasDependenciesAlert,
    showPluginHasDependentsAlert,
} from './alerts'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

export async function handleEnablePlugin(plugin: AnyPlugin) {
    const dependencies = getPluginDependencies(plugin)!
    const disabledDeps = dependencies?.filter(dep => !isPluginEnabled(dep))

    async function action() {
        await enablePlugin(plugin)
        await runPluginLate(plugin)
    }

    if (disabledDeps?.length)
        showPluginHasDependenciesAlert(plugin, disabledDeps, action)
    else await action()
}

export async function handleDisablePlugin(plugin: AnyPlugin) {
    const { dependents } = getInternalPluginMeta(plugin)
    const action = () => disablePlugin(plugin)

    const enabledDeps = dependents.filter(isPluginEnabled)

    if (enabledDeps.length)
        showPluginHasDependentsAlert(plugin, enabledDeps, action)
    else await action()
}
