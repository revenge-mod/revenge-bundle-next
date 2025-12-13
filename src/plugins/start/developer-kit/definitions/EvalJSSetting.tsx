import { TableRowAssetIcon } from '@revenge-mod/components'
import { RouteNames, Setting } from '../constants'
import EvalJSSettingScreen from '../screens/EvalJSSettingScreen'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const EvalJSSetting: SettingsItem = {
    parent: Setting.RevengeDeveloper,
    type: 'route',
    IconComponent: () => <TableRowAssetIcon name="FileIcon" />,
    title: () => 'Evaluate JavaScript',
    useDescription: () => 'Runs a JavaScript code snippet.',
    screen: {
        route: RouteNames[Setting.EvalJS],
        getComponent: () => EvalJSSettingScreen,
    },
}

export default EvalJSSetting
