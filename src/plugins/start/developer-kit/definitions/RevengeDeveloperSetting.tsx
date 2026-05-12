import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { RouteNames, Setting } from '../constants'
import defer * as RevengeDeveloperSettingScreen from '../screens/RevengeDeveloperSettingScreen'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const RevengeDeveloperSetting: SettingsItem = {
    parent: null,
    type: 'route',
    IconComponent: () => <TableRowAssetIcon name="WrenchIcon" />,
    useTitle: () => 'Developer',
    screen: {
        route: RouteNames[Setting.RevengeDeveloper],
        getComponent: () => RevengeDeveloperSettingScreen.default,
    },
}

export default RevengeDeveloperSetting
