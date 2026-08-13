import {
    onSettingsModulesLoaded,
    registerSettingsItem,
} from '@revenge-mod/discord/modules/settings'
import { Setting } from '~plugins/start/settings/constants'
import RevengeEnterRecoveryModeSetting from './definitions/RevengeEnterRecoveryModeSetting'

onSettingsModulesLoaded(() => {
    registerSettingsItem(
        Setting.RevengeEnterRecoveryMode,
        RevengeEnterRecoveryModeSetting,
    )
})
