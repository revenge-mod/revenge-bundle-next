import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { isDefaultsOnlyBoot } from '@revenge-mod/plugins/_'
import { useEnabledPluginCount } from '@revenge-mod/plugins/_/react'
import { RouteNames, Setting } from '../constants'
import defer * as RevengePluginsSettingScreen from '../screens/RevengePluginsSettingScreen'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const RevengePluginsSetting: SettingsItem = {
    parent: null,
    type: 'route',
    IconComponent: () => <TableRowAssetIcon name="PuzzlePieceIcon" />,
    useTitle: () => 'Plugins',
    useTrailing: () =>
        `${useEnabledPluginCount()} enabled` +
        (isDefaultsOnlyBoot ? ' (recovery)' : ''),
    screen: {
        route: RouteNames[Setting.RevengePlugins],
        getComponent: () => RevengePluginsSettingScreen.default,
    },
}

export default RevengePluginsSetting
