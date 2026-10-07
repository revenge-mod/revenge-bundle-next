import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { RouteNames, Setting } from '../constants'
import defer * as RevengePluginsUpdatesSettingScreen from '../screens/RevengePluginsUpdatesSettingScreen'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const RevengePluginsUpdatesSetting: SettingsItem = {
    parent: null,
    type: 'route',
    IconComponent: () => <TableRowAssetIcon name="DownloadIcon" />,
    useTitle: () => 'Plugin Updates',
    screen: {
        route: RouteNames[Setting.RevengePluginsUpdates],
        getComponent: () => RevengePluginsUpdatesSettingScreen.default,
    },
}

export default RevengePluginsUpdatesSetting
