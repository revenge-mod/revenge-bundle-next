import {
    disablePlugin,
    enablePlugin,
    getMissingPluginDependencies,
    getPluginDependencies,
    getPluginDependents,
    isPluginEnabledInSavedStates,
    runPluginLate,
} from '@revenge-mod/plugins/_'
import {
    installFromRepo,
    planInstall,
} from '@revenge-mod/plugins/_/repositories'
import { noop } from '@revenge-mod/utils/callback'
import {
    showPluginHasDependenciesAlert,
    showPluginHasDependentsAlert,
    showPluginMissingDependenciesAlert,
} from './alerts'
import { confirmPlan, messageOf, showErrorToast } from './repos'
import type { AnyPlugin } from '@revenge-mod/plugins/_'
import type { InstallPlan } from '@revenge-mod/plugins/_/repositories'

export async function handleEnablePlugin(plugin: AnyPlugin) {
    const missing = getMissingPluginDependencies(plugin)
    if (missing.length) {
        const deps = missing.map(id => ({
            id,
            range: plugin.manifest.dependencies?.[id]?.version ?? '*',
        }))

        // Required deps can be uninstalled. Offer installing them back.
        showPluginMissingDependenciesAlert(plugin, deps, () => {
            // Non-async because we can't show 2 dialogs at the same time, so we need for the PluginMissing to close first
            // Then the ConfirmPlan dialog will open, and then the install will run after that.
            Promise.all(missing.map(id => planInstall(id)))
                .then(
                    it =>
                        it.reduce(
                            (acc, cur) => ({
                                actions: [...acc.actions, ...cur.actions],
                                warnings: [...acc.warnings, ...cur.warnings],
                            }),
                            { actions: [], warnings: [] },
                        ) satisfies InstallPlan,
                )
                .then(async plan => {
                    const accepted = await confirmPlan(plan)
                    if (!accepted) return false

                    await installFromRepo(plan)

                    await handleEnablePlugin(plugin)
                })
                .catch(e => showErrorToast(messageOf(e)))
        })
        return
    }

    const dependencies = getPluginDependencies(plugin)
    const disabledDeps = dependencies.filter(
        dep => !isPluginEnabledInSavedStates(dep),
    )

    async function action() {
        try {
            await enablePlugin(plugin, true)
        } catch (e) {
            // Requirements not satisfied by native, don't try to start
            showErrorToast(messageOf(e))
            return
        }

        await runPluginLate(plugin).catch(noop)
    }

    if (disabledDeps.length)
        showPluginHasDependenciesAlert(plugin, disabledDeps, action)
    else await action()
}

export async function handleDisablePlugin(plugin: AnyPlugin) {
    const dependents = getPluginDependents(plugin, true)
    const action = () => disablePlugin(plugin)

    const enabledDeps = dependents.filter(isPluginEnabledInSavedStates)

    if (enabledDeps.length)
        showPluginHasDependentsAlert(plugin, enabledDeps, action)
    else await action()
}
