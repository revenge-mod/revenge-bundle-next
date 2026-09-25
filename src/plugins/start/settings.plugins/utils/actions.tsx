import {
    disablePluginInActiveSlot,
    enablePluginInActiveSlot,
    getLinkedOptionalDependents,
    getMissingPluginDependencies,
    getPluginDependencies,
    getPluginDependents,
    getRelinkableDependents,
    isPluginEnabledInActiveSlot,
    runPluginLate,
    stopPlugin,
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
    showPluginRelinkAlert,
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
        dep => !isPluginEnabledInActiveSlot(dep),
    )

    async function action() {
        try {
            await enablePluginInActiveSlot(plugin, true)
        } catch (e) {
            // Requirements not satisfied by native, don't try to start
            showErrorToast(messageOf(e))
            return
        }

        await runPluginLate(plugin).catch(noop)

        // Dependents started while this was disabled aren't linked to this plugin.
        // Only a restart will relink.
        const relinkable = getRelinkableDependents(plugin)
        if (relinkable.length)
            showPluginRelinkAlert(plugin, relinkable, async restart => {
                await Promise.all(
                    relinkable
                        .filter(dep => restart.has(dep.manifest.id))
                        .map(dep =>
                            stopPlugin(dep)
                                .then(() => runPluginLate(dep))
                                .catch(noop),
                        ),
                )
            })
    }

    if (disabledDeps.length)
        showPluginHasDependenciesAlert(plugin, disabledDeps, action)
    else await action()
}

export async function handleDisablePlugin(plugin: AnyPlugin) {
    const optionals = getLinkedOptionalDependents(plugin)
    const required = getPluginDependents(plugin)

    const action = async (keepRunning: Set<string>) => {
        await disablePluginInActiveSlot(plugin)

        await Promise.all(
            optionals.map(dep => {
                if (!keepRunning.has(dep.manifest.id))
                    return disablePluginInActiveSlot(dep).catch(noop)

                // Restarts without this plugin, so it links one fewer dependency than before.
                return runPluginLate(dep).catch(noop)
            }),
        )
    }

    const enabledRequired = required.filter(isPluginEnabledInActiveSlot)

    // Required dependents will be disabled via cascade. Optionals can be restarted.
    if (enabledRequired.length || optionals.length)
        showPluginHasDependentsAlert(plugin, enabledRequired, optionals, action)
    else await action(new Set())
}
