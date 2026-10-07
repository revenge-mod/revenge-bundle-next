import {
    AlertActionCreators,
    ToastActionCreators,
} from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { RootNavigationRef } from '@revenge-mod/discord/modules/main_tabs_v2'
import {
    deleteStorageForPlugin,
    getPluginDependents,
    isPluginEnabledInActiveSlot,
    isPluginStarted,
    uninstallExternalPlugin,
} from '@revenge-mod/plugins/_'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { getErrorStack } from '@revenge-mod/utils/error'
import { deleteJsonStorageForPlugin } from '~plugins/preinit/api/json-storage'
import PluginClearDataConfirmationAlert from '../components/PluginClearDataConfirmationAlert'
import PluginDependentsChoiceAlert from '../components/PluginDependentsChoiceAlert'
import PluginHasDependenciesAlert from '../components/PluginHasDependenciesAlert'
import PluginMissingDependenciesAlert from '../components/PluginMissingDependenciesAlert'
import PluginUninstallConfirmationAlert from '../components/PluginUninstallConfirmationAlert'
import RepoRemoveConfirmationAlert from '../components/RepoRemoveConfirmationAlert'
import type { AnyPlugin } from '@revenge-mod/plugins/_'
import type { Repo } from '@revenge-mod/plugins/_/repositories'

const { Text } = Design

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
        <PluginUninstallConfirmationAlert
            plugin={plugin}
            dependencies={getCascadeDisabledDependents(plugin)}
            action={action}
        />,
    )
}

/** Enabled required dependents that disabling this plugin cascades transitively. */
function getCascadeDisabledDependents(plugin: AnyPlugin) {
    const disabled = new Set<AnyPlugin>()
    if (!isPluginEnabledInActiveSlot(plugin)) return []

    const visit = (p: AnyPlugin) => {
        for (const dep of getPluginDependents(p))
            if (!disabled.has(dep) && isPluginEnabledInActiveSlot(dep)) {
                disabled.add(dep)
                visit(dep)
            }
    }

    visit(plugin)
    return [...disabled]
}

export function openPluginSettings(plugin: AnyPlugin) {
    if (!plugin.SettingsComponent || !isPluginStarted(plugin)) return

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
    required: AnyPlugin[],
    optional: AnyPlugin[],
    action: (keepRunning: Set<string>) => Promise<void>,
) {
    AlertActionCreators.openAlert(
        'plugin-has-dependents',
        <PluginDependentsChoiceAlert
            title="Plugin currently in use"
            content={
                <Text color="text-default">
                    Other plugins are currently using{' '}
                    <Text variant="text-md/semibold" color="text-default">
                        {plugin.manifest.name}
                    </Text>
                    .{'\n'}
                    {required.length > 0 &&
                        'Plugins that need it will be disabled. '}
                    {optional.length > 0 &&
                        'Select which plugins to keep running. They will restart without this plugin.'}
                </Text>
            }
            confirmText="Continue"
            toggleLabel="Keep running"
            locked={required}
            selectable={optional}
            action={action}
        />,
    )
}

/** Offers disabling dependencies nothing else uses after this plugin is disabled. */
export function showPluginUnusedDependenciesAlert(
    plugin: AnyPlugin,
    dependencies: AnyPlugin[],
    action: (disable: Set<string>) => Promise<void>,
) {
    AlertActionCreators.openAlert(
        'plugin-unused-dependencies',
        <PluginDependentsChoiceAlert
            title="Disable unused plugins?"
            content={
                <Text color="text-default">
                    These plugins were enabled for{' '}
                    <Text variant="text-md/semibold" color="text-default">
                        {plugin.manifest.name}
                    </Text>
                    , and no other plugin uses them now. Select which plugins to
                    disable.
                </Text>
            }
            confirmText="Disable"
            cancelText="Keep all"
            toggleLabel="Disable"
            locked={[]}
            selectable={dependencies}
            action={action}
        />,
    )
}

/** Offers restarting the running plugins that could not link this one when they started. */
export function showPluginRelinkAlert(
    plugin: AnyPlugin,
    dependents: AnyPlugin[],
    action: (restart: Set<string>) => Promise<void>,
) {
    AlertActionCreators.openAlert(
        'plugin-relink-dependents',
        <PluginDependentsChoiceAlert
            title="Restart plugins for features?"
            content={
                <Text color="text-default">
                    These plugins started while{' '}
                    <Text variant="text-md/semibold" color="text-default">
                        {plugin.manifest.name}
                    </Text>{' '}
                    was unavailable. You may receive new features if you restart
                    them now.
                </Text>
            }
            confirmText="Restart"
            cancelText="No thanks"
            confirmVariant="primary"
            toggleLabel="Restart"
            locked={[]}
            selectable={dependents}
            action={action}
        />,
    )
}

const CircleXIconComponent = lookupGeneratedIconComponent(
    'CircleXIcon',
    'CircleXIcon-primary',
    'CircleXIcon-secondary',
)!

export function showErrorToast(message: string) {
    ToastActionCreators.open({
        key: 'REVENGE_REPOSITORIES_ERROR',
        content: message,
        IconComponent: CircleXIconComponent,
    })
}
