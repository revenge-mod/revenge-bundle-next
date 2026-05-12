import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { Linking } from 'react-native'
import { Setting } from '../constants'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const RevengeDiscordSetting: SettingsItem = {
    parent: Setting.Revenge,
    IconComponent: () => <TableRowAssetIcon name="Discord" />,
    useTitle: () => 'Discord Server',
    useDescription: () => __BUILD_DISCORD_SERVER_URL__,
    onPress: () => {
        Linking.openURL(__BUILD_DISCORD_SERVER_URL__)
    },
    type: 'pressable',
}

export default RevengeDiscordSetting
