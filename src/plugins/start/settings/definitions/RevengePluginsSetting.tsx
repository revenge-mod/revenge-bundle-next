import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { BundleUpdaterManager } from '@revenge-mod/discord/native'
import { isPluginEnabled, pEmitter, pList } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import { useReRender } from '@revenge-mod/utils/react'
import { useEffect } from 'react'
import { RouteNames, Setting } from '../constants'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const RevengePluginsSetting: SettingsItem = {
    parent: null,
    type: 'route',
    IconComponent: () => <TableRowAssetIcon name="PuzzlePieceIcon" />,
    title: () => 'Plugins',
    useTrailing: () => `${useEnabledPluginCount()} enabled`,
    screen: {
        route: RouteNames[Setting.RevengePlugins],
        getComponent: () =>
            require('../screens/RevengePluginsSettingScreen').default,
    },
}

let enabledCount = 0

for (const plugin of pList.values()) if (isPluginEnabled(plugin)) enabledCount++

pEmitter.on('disabled', () => {
    enabledCount--
})

pEmitter.on('enabled', () => {
    enabledCount++
})

function useEnabledPluginCount() {
    const reRender = useReRender()

    useEffect(() => {
        pEmitter.on('disabled', reRender)
        pEmitter.on('enabled', reRender)

        return () => {
            pEmitter.off('disabled', reRender)
            pEmitter.off('enabled', reRender)
        }
    }, [reRender])

    return enabledCount
}

const { AlertActionButton, AlertModal, Text } = Design

pEmitter.on('started', showReloadRequiredAlertIfNeeded)
pEmitter.on('stopped', showReloadRequiredAlertIfNeeded)

function showReloadRequiredAlertIfNeeded(plugin: AnyPlugin) {
    if (plugin.flags & PluginFlags.ReloadRequired) {
        const plugins = [...pList.values()].filter(
            plugin => plugin.flags & PluginFlags.ReloadRequired,
        )

        AlertActionCreators.openAlert(
            'plugin-reload-required',
            <PluginReloadRequiredAlert plugins={plugins} />,
        )
    }
}

function PluginReloadRequiredAlert({ plugins }: { plugins: AnyPlugin[] }) {
    return (
        <AlertModal
            title="Reload required"
            content={
                <Text variant="text-md/medium" color="header-secondary">
                    The following plugins require a reload to apply changes:
                    {'\n'}
                    {plugins.map(plugin => (
                        <>
                            <Text
                                key={plugin.manifest.id}
                                variant="text-md/bold"
                                color="text-normal"
                            >
                                {plugin.manifest.name}
                            </Text>
                            {', '}
                        </>
                    ))}
                </Text>
            }
            actions={
                <>
                    <AlertActionButton
                        variant="destructive"
                        text="Reload"
                        onPress={() => {
                            BundleUpdaterManager.reload()
                        }}
                    />
                    <AlertActionButton variant="secondary" text="Not now" />
                </>
            }
        />
    )
}

export default RevengePluginsSetting
