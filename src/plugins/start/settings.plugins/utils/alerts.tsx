import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { RootNavigationRef } from '@revenge-mod/discord/modules/main_tabs_v2'
import {
    deleteStorageForPlugin,
    isPluginStartable,
    uninstallExternalPlugin,
} from '@revenge-mod/plugins/_'
import { getErrorStack } from '@revenge-mod/utils/error'
import { deleteJsonStorageForPlugin } from '~plugins/preinit/api.json-storage'
import PluginClearDataConfirmationAlert from '../components/PluginClearDataConfirmationAlert'
import PluginHasDependenciesAlert from '../components/PluginHasDependenciesAlert'
import PluginHasDependentsAlert from '../components/PluginHasDependentsAlert'
import PluginMissingDependenciesAlert from '../components/PluginMissingDependenciesAlert'
import PluginUninstallConfirmationAlert from '../components/PluginUninstallConfirmationAlert'
import RepoRemoveConfirmationAlert from '../components/RepoRemoveConfirmationAlert'
import type { AnyPlugin } from '@revenge-mod/plugins/_'
import type { Repo } from '@revenge-mod/plugins/_/repositories'

export function showPluginClearDataConfirmation(
    plugin: AnyPlugin,
    callback: () => void,
) {
    const KEY = 'plugin-clear-data-confirmation'

    async function action() {
        try {
            await deleteStorageForPlugin(plugin)
            // Trigger update for JSON storage
            await deleteJsonStorageForPlugin(plugin)
        } catch (e) {
            alert(getErrorStack(e))
        }
        callback()
    }

    AlertActionCreators.openAlert(
        KEY,
        <PluginClearDataConfirmationAlert plugin={plugin} action={action} />,
    )
}

export function showPluginUninstallConfirmation(
    plugin: AnyPlugin,
    callback: () => void,
) {
    const KEY = 'plugin-uninstall-confirmation'

    async function action() {
        // Uninstalling also deletes data
        await uninstallExternalPlugin(plugin)
        callback()
    }

    AlertActionCreators.openAlert(
        KEY,
        <PluginUninstallConfirmationAlert plugin={plugin} action={action} />,
    )
}

export function openPluginSettings(plugin: AnyPlugin) {
    if (!plugin.SettingsComponent || !isPluginStartable(plugin)) return

    const navigation = RootNavigationRef.getRootNavigationRef()
    if (navigation.isReady()) navigation.navigate(plugin.manifest.id)
    else
        navigation.addListener('ready', function self() {
            navigation.navigate(plugin.manifest.id)
            navigation.removeListener('ready', self)
        })
}

export function showPluginHasDependenciesAlert(
    plugin: AnyPlugin,
    dependencies: AnyPlugin[],
    action: () => Promise<void>,
) {
    AlertActionCreators.openAlert(
        'plugin-has-dependencies',
        <PluginHasDependenciesAlert
            plugin={plugin}
            dependencies={dependencies}
            action={action}
        />,
    )
}

export function showPluginMissingDependenciesAlert(
    plugin: AnyPlugin,
    dependencies: { id: string; range: string }[],
    action: () => unknown,
) {
    AlertActionCreators.openAlert(
        'plugin-missing-dependencies',
        <PluginMissingDependenciesAlert
            plugin={plugin}
            dependencies={dependencies}
            action={action}
        />,
    )
}

export function showRemoveRepoConfirmation(
    repo: Repo,
    callback: () => Promise<void> | void,
) {
    const KEY = 'repo-remove-confirmation'

    async function action() {
        await callback()
    }

    AlertActionCreators.openAlert(
        KEY,
        <RepoRemoveConfirmationAlert repo={repo} action={action} />,
    )
}

export function showPluginHasDependentsAlert(
    plugin: AnyPlugin,
    dependents: AnyPlugin[],
    action: () => Promise<void>,
) {
    AlertActionCreators.openAlert(
        'plugin-has-dependents',
        <PluginHasDependentsAlert
            plugin={plugin}
            dependents={dependents}
            action={action}
        />,
    )
}
