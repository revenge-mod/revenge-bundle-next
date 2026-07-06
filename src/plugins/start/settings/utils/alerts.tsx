import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { RootNavigationRef } from '@revenge-mod/discord/modules/main_tabs_v2'
import { uninstallExternalPlugin } from '@revenge-mod/plugins/_'
import { deleteStorageForPlugin } from '~plugins/preinit/api.storage'
import PluginClearDataConfirmationAlert from '../components/PluginClearDataConfirmationAlert'
import PluginHasDependenciesAlert from '../components/PluginHasDependenciesAlert'
import PluginHasDependentsAlert from '../components/PluginHasDependentsAlert'
import PluginStatesProvider from '../components/PluginStateProvider'
import PluginUninstallConfirmationAlert from '../components/PluginUninstallConfirmationAlert'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

export function showPluginClearDataConfirmation(
    plugin: AnyPlugin,
    callback: () => void,
) {
    const KEY = 'plugin-clear-data-confirmation'

    async function action() {
        await deleteStorageForPlugin(plugin)
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
        await deleteStorageForPlugin(plugin)
        await uninstallExternalPlugin(plugin)
        callback()
    }

    AlertActionCreators.openAlert(
        KEY,
        <PluginUninstallConfirmationAlert plugin={plugin} action={action} />,
    )
}

export function openPluginSettings(plugin: AnyPlugin) {
    if (!plugin.SettingsComponent) return

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
        <PluginStatesProvider>
            <PluginHasDependenciesAlert
                plugin={plugin}
                dependencies={dependencies}
                action={action}
            />
        </PluginStatesProvider>,
    )
}

export function showPluginHasDependentsAlert(
    plugin: AnyPlugin,
    dependents: AnyPlugin[],
    action: () => Promise<void>,
) {
    AlertActionCreators.openAlert(
        'plugin-has-dependents',
        <PluginStatesProvider>
            <PluginHasDependentsAlert
                plugin={plugin}
                dependents={dependents}
                action={action}
            />
        </PluginStatesProvider>,
    )
}
