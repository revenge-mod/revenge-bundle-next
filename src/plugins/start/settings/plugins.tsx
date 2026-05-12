import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { AlertActionCreators } from '@revenge-mod/discord/actions'
import {
    refreshSettingsNavigator,
    registerSettingsItem,
} from '@revenge-mod/discord/modules/settings'
import { pEmitter, pList } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import { useLayoutEffect } from 'react'
import defer * as NavigatorHeaderWithIcon from './components/NavigatorHeaderWithIcon'
import PluginsFailedToStartAlert from './components/PluginsFailedToStartAlert'
import PluginsRequireReloadAlert from './components/PluginsRequireReloadAlert'
import { Setting } from './constants'
import type { StackScreenProps } from '@react-navigation/stack'
import type { ReactNavigationParamList } from '@revenge-mod/externals/react-navigation'
import type { PluginApi } from '@revenge-mod/plugins/types'

/// SETTINGS ROUTES

pEmitter.on('started', plugin => {
    if (plugin.SettingsComponent) {
        const api = plugin.api as PluginApi<any>
        const Component = plugin.SettingsComponent!

        function PluginSettings({
            navigation,
        }: StackScreenProps<ReactNavigationParamList>) {
            // biome-ignore lint/correctness/useExhaustiveDependencies: We only want to set options once
            useLayoutEffect(() => {
                if (plugin.manifest.icon)
                    navigation.setOptions({
                        headerTitle: () => (
                            <NavigatorHeaderWithIcon.default
                                title={plugin.manifest.name}
                                icon={plugin.manifest.icon!}
                            />
                        ),
                    })
                else
                    navigation.setOptions({
                        title: plugin.manifest.name,
                    })
            }, [])

            return <Component api={api} />
        }

        api.cleanup(
            registerSettingsItem(plugin.manifest.id, {
                parent: Setting.Revenge,
                type: 'route',
                IconComponent: plugin.manifest.icon
                    ? () => <TableRowAssetIcon name={plugin.manifest.icon!} />
                    : undefined,
                useTitle: () => plugin.manifest.name,
                screen: {
                    route: plugin.manifest.id,
                    getComponent: () => PluginSettings,
                },
            }),
            refreshSettingsNavigator,
            // TODO(PalmDevs): In the future, we may allow pinning plugin settings, so we'll need this cleanup
            // () => refreshSettingsOverviewScreen(),
        )

        refreshSettingsNavigator()
    }
})

/// RELOAD REQUIRED ALERT

function showReloadRequiredAlertIfNeeded() {
    const plugins = [...pList.values()].filter(
        plugin => plugin.flags & PluginFlags.ReloadRequired,
    )

    if (!plugins.length) return

    AlertActionCreators.openAlert(
        'plugins-require-reload',
        <PluginsRequireReloadAlert plugins={plugins} />,
    )
}

function showErrorAlertIfNeeded() {
    const plugins = [...pList.values()].filter(
        plugin => plugin.flags & PluginFlags.Errored,
    )

    if (!plugins.length) return

    AlertActionCreators.openAlert(
        'plugins-failed-to-start',
        <PluginsFailedToStartAlert plugins={plugins} />,
    )
}

pEmitter.on('flagUpdate', plugin => {
    if (plugin.flags & PluginFlags.ReloadRequired)
        showReloadRequiredAlertIfNeeded()
})

pEmitter.on('stopped', plugin => {
    if (plugin.flags & PluginFlags.Errored) showErrorAlertIfNeeded()
})

showErrorAlertIfNeeded()
showReloadRequiredAlertIfNeeded()
