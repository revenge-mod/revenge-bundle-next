import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { RouteNames, Setting } from '../constants'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const UpdateBundleScreen: SettingsItem = {
    parent: Setting.RevengeDeveloper,
    type: 'route',
    IconComponent: () => <TableRowAssetIcon name="FileUpIcon" />,
    title: () => 'Update Bundle File',
    screen: {
        route: RouteNames[Setting.UpdateBundle],
        getComponent: () => require('../screens/UpdateBundleScreen').default,
    },
}

export default UpdateBundleScreen
