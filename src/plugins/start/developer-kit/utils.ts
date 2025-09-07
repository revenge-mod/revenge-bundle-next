import {
    addSettingsItemToSection,
    registerSettingsItems,
} from '@revenge-mod/discord/modules/settings'
import { api } from '.'
import { Setting } from './constants'
import AssetBrowserSetting from './definitions/AssetBrowserSetting'
import EvalJSSetting from './definitions/EvalJSSetting'
import RDTAutoConnectSetting from './definitions/RDTAutoConnectSetting'
import RDTConnectSetting from './definitions/RDTConnectSetting'
import RDTDisconnectSetting from './definitions/RDTDisconnectSetting'
import RDTVersionSetting from './definitions/RDTVersionSetting'
import RevengeDeveloperSetting from './definitions/RevengeDeveloperSetting'
import TestErrorBoundarySetting from './definitions/TestErrorBoundarySetting'
import UpdateBundle from './definitions/UpdateBundle'

export function register() {
    api.cleanup(
        registerSettingsItems({
            [Setting.RevengeDeveloper]: RevengeDeveloperSetting,
            [Setting.RDTVersion]: RDTVersionSetting,
            [Setting.RDTAutoConnect]: RDTAutoConnectSetting,
            [Setting.RDTConnect]: RDTConnectSetting,
            [Setting.RDTDisconnect]: RDTDisconnectSetting,
            [Setting.EvalJS]: EvalJSSetting,
            [Setting.UpdateBundle]: UpdateBundle,
            [Setting.AssetBrowser]: AssetBrowserSetting,
            [Setting.TestErrorBoundary]: TestErrorBoundarySetting,
        }),
        addSettingsItemToSection('REVENGE', Setting.RevengeDeveloper),
    )
}
