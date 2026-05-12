import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { version } from 'react'
import { Setting } from '../constants'
import { CopyableSetting } from './shared'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const ReactVersionSetting: SettingsItem = CopyableSetting(
    {
        parent: Setting.Revenge,
        IconComponent: () => <TableRowAssetIcon name="ScienceIcon" />,
        useTitle: () => 'React',
    },
    () => version,
)

export default ReactVersionSetting
