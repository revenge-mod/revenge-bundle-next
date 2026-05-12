import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { RouteNames, Setting } from '../constants'
import defer * as AssetBrowserSettingScreen from '../screens/AssetBrowserSettingScreen'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const AssetBrowserSetting: SettingsItem = {
    parent: Setting.RevengeDeveloper,
    type: 'route',
    IconComponent: () => <TableRowAssetIcon name="ImageIcon" />,
    useTitle: () => 'Asset Browser',
    screen: {
        route: RouteNames[Setting.AssetBrowser],
        getComponent: () => AssetBrowserSettingScreen.default,
    },
}

export default AssetBrowserSetting
