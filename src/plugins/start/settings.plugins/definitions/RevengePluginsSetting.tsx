import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { isPluginEnabled, pEmitter, pList } from '@revenge-mod/plugins/_'
import { useReRender } from '@revenge-mod/utils/react'
import { useEffect } from 'react'
import { RouteNames, Setting } from '../constants'
import defer * as RevengePluginsSettingScreen from '../screens/RevengePluginsSettingScreen'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const RevengePluginsSetting: SettingsItem = {
    parent: null,
    type: 'route',
    IconComponent: () => <TableRowAssetIcon name="PuzzlePieceIcon" />,
    useTitle: () => 'Plugins',
    useTrailing: () => `${useEnabledPluginCount()} enabled`,
    screen: {
        route: RouteNames[Setting.RevengePlugins],
        getComponent: () => RevengePluginsSettingScreen.default,
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

export default RevengePluginsSetting
