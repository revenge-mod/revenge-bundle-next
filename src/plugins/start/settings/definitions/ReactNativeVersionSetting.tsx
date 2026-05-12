import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { Setting } from '../constants'
import { CopyableSetting } from './shared'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

// TODO(PalmDevs): Rolldown 1.0.0-beta.34 breaks destructuring with quoted keys, revert to original when this is fixed
const ossReleaseVersion =
    // @ts-expect-error
    HermesInternal.getRuntimeProperties()['OSS Release Version']

const ReactNativeVersionSetting: SettingsItem = CopyableSetting(
    {
        parent: Setting.Revenge,
        IconComponent: () => <TableRowAssetIcon name="ScienceIcon" />,
        useTitle: () => 'React Native',
    },
    // slice "for RN " off the version string
    () => ossReleaseVersion.slice(7),
)

export default ReactNativeVersionSetting
