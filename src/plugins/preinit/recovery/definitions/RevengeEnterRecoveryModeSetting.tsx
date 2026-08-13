import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { reloadApp } from '@revenge-mod/modules/native/app'
import {
    isDefaultsOnlyBoot,
    requestNextBootDefaultsOnly,
} from '@revenge-mod/plugins/_'
import { Setting } from '~plugins/start/settings/constants'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const RevengeEnterRecoveryModeSetting: SettingsItem = {
    parent: Setting.Revenge,
    type: 'pressable',
    useIsDisabled: () => isDefaultsOnlyBoot,
    useTitle: () => 'Enter Recovery Mode',
    useDescription: () =>
        isDefaultsOnlyBoot
            ? 'Currently in Recovery Mode. Reload to exit.'
            : 'Run Revenge with default plugins only for one boot. Use if plugins are causing issues.',
    IconComponent: () => <TableRowAssetIcon name="ShieldIcon" />,
    onPress: () => {
        requestNextBootDefaultsOnly()
        reloadApp()
    },
}

export default RevengeEnterRecoveryModeSetting
