import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { Setting } from '../constants'
import { disconnect, useIsConnected } from '../devtools'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const DTDisconnectSetting: SettingsItem = {
    parent: Setting.RevengeDeveloper,
    IconComponent: () => <TableRowAssetIcon name="DenyIcon" variant="danger" />,
    variant: 'danger',
    useTitle: () => 'Disconnect from DevTools',
    usePredicate: useIsConnected,
    onPress: disconnect,
    type: 'pressable',
}

export default DTDisconnectSetting
