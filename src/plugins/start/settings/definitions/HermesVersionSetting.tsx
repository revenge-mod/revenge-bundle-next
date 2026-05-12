import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { Setting } from '../constants'
import { CopyableSetting } from './shared'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

// @ts-expect-error
const props = HermesInternal.getRuntimeProperties()

const HermesVersionSetting: SettingsItem = CopyableSetting(
    {
        parent: Setting.Revenge,
        IconComponent: () => <TableRowAssetIcon name="TranscriptOutlineIcon" />,
        useTitle: () => 'Hermes',
    },
    () => `${props['Bytecode Version']} (${props.Build})`,
)

export default HermesVersionSetting
