import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { BundleUpdaterManager } from '@revenge-mod/discord/native'
import { Setting } from '../constants'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const ReloadSetting: SettingsItem = {
    parent: Setting.Revenge,
    IconComponent: () => <TableRowAssetIcon name="RetryIcon" />,
    useTitle: () => 'Reload App',
    onPress: () => {
        BundleUpdaterManager.reload()
    },
    type: 'pressable',
}

export default ReloadSetting
