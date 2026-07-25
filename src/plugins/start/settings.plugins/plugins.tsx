import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import {
    AlertActionCreators,
    ToastActionCreators,
} from '@revenge-mod/discord/actions'
import {
    refreshSettingsNavigator,
    registerSettingsItem,
} from '@revenge-mod/discord/modules/settings'
import {
    isPluginErrored,
    isPluginPendingReload,
    isPluginPendingUpdate,
    pEmitter,
    pList,
} from '@revenge-mod/plugins/_'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { useLayoutEffect } from 'react'
import { Setting } from '../settings/constants'
import defer * as NavigatorHeaderWithIcon from './components/NavigatorHeaderWithIcon'
import PluginInstallConfirmAlert from './components/PluginInstallConfirmAlert'
import PluginInstallFailedAlert from './components/PluginInstallFailedAlert'
import PluginsFailedToStartAlert from './components/PluginsFailedToStartAlert'
import PluginsRequireReloadAlert from './components/PluginsRequireReloadAlert'
import type { StackScreenProps } from '@react-navigation/stack'
import type { ReactNavigationParamList } from '@revenge-mod/externals/react-navigation'
import type { PluginApi } from '@revenge-mod/plugins/types'

const PluginsRequireReloadAlertKey = 'plugins-require-reload'
const PluginsFailedToStartAlertKey = 'plugins-failed-to-start'

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

function showPendingReloadAlertIfNeeded() {
    const plugins = [...pList.values()].filter(
        plugin =>
            isPluginPendingReload(plugin) || isPluginPendingUpdate(plugin),
    )

    if (!plugins.length) return

    AlertActionCreators.dismissAlert(PluginsRequireReloadAlertKey)
    AlertActionCreators.openAlert(
        PluginsRequireReloadAlertKey,
        <PluginsRequireReloadAlert plugins={plugins} />,
    )
}

function showErrorAlertIfNeeded() {
    const plugins = [...pList.values()].filter(plugin =>
        isPluginErrored(plugin),
    )

    if (!plugins.length) return

    AlertActionCreators.dismissAlert(PluginsFailedToStartAlertKey)
    AlertActionCreators.openAlert(
        PluginsFailedToStartAlertKey,
        <PluginsFailedToStartAlert plugins={plugins} />,
    )
}

pEmitter.on('flagUpdate', plugin => {
    if (isPluginPendingReload(plugin) || isPluginPendingUpdate(plugin))
        showPendingReloadAlertIfNeeded()
})

pEmitter.on('stopped', plugin => {
    if (isPluginErrored(plugin)) showErrorAlertIfNeeded()
})

/// PLUGIN INSTALL FEEDBACK

const pluginInstallToastKeyFor = (id: string) => `REVENGE_PLUGIN_INSTALL:${id}`
const PluginInstallFailedAlertKey = 'plugin-install-failed'
const PluginInstallConfirmAlertKey = 'plugin-install-confirm'

pEmitter.on('installReady', prompt => {
    AlertActionCreators.dismissAlert(PluginInstallConfirmAlertKey)
    AlertActionCreators.openAlert(
        PluginInstallConfirmAlertKey,
        <PluginInstallConfirmAlert prompt={prompt} />,
    )
})

pEmitter.on('install', result => {
    if (result.error !== false) {
        AlertActionCreators.dismissAlert(PluginInstallFailedAlertKey)
        AlertActionCreators.openAlert(
            PluginInstallFailedAlertKey,
            <PluginInstallFailedAlert error={result.error} />,
        )
        return
    }

    if (result.pending) {
        // Applied on disk only, the new version loads at next reload
        showInstallToast(
            `Downloaded ${pList.get(result.id)?.manifest.name || result.id} ${result.version}, reload to apply`,
            result.id,
        )
        return
    }

    showInstallToast(
        result.updated
            ? `Updated ${result.manifest.name}`
            : `Installed ${result.manifest.name}`,
        result.manifest.id,
    )
})

const CircleCheckIcon = lookupGeneratedIconComponent(
    'CircleCheckIcon',
    'CircleCheckIcon-secondary',
    'CircleCheckIcon-primary',
)

function showInstallToast(content: string, id: string) {
    ToastActionCreators.open({
        key: pluginInstallToastKeyFor(id),
        content,
        IconComponent: CircleCheckIcon,
    })
}

showErrorAlertIfNeeded()
showPendingReloadAlertIfNeeded()
