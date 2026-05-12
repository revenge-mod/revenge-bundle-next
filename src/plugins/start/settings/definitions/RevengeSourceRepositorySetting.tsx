import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { Linking } from 'react-native'
import { Setting } from '../constants'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const RevengeSourceRepositorySetting: SettingsItem = {
    parent: Setting.Revenge,
    IconComponent: () => <TableRowAssetIcon name="PaperIcon" />,
    useTitle: () => 'Source Code',
    useDescription: () => __BUILD_SOURCE_REPOSITORY_URL__,
    onPress: () => {
        Linking.openURL(__BUILD_SOURCE_REPOSITORY_URL__)
    },
    type: 'pressable',
}

export default RevengeSourceRepositorySetting
