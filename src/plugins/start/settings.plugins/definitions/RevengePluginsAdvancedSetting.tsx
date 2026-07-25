import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { RouteNames, Setting } from '../constants'
import defer * as RevengePluginsAdvancedSettingScreen from '../screens/RevengePluginsAdvancedSettingScreen'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const RevengePluginsAdvancedSetting: SettingsItem = {
    parent: null,
    type: 'route',
    IconComponent: () => <TableRowAssetIcon name="SettingsIcon" />,
    useTitle: () => 'Advanced',
    screen: {
        route: RouteNames[Setting.RevengePluginsAdvanced],
        getComponent: () => RevengePluginsAdvancedSettingScreen.default,
    },
}

export default RevengePluginsAdvancedSetting
