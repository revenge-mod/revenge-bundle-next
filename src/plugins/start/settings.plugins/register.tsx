import {
    addSettingsItemToSection,
    registerSettingsItems,
} from '@revenge-mod/discord/modules/settings'
import { Setting } from './constants'
import RevengePluginsAdvancedSetting from './definitions/RevengePluginsAdvancedSetting'
import RevengePluginsBrowseSetting from './definitions/RevengePluginsBrowseSetting'
import RevengePluginsSetting from './definitions/RevengePluginsSetting'

registerSettingsItems({
    [Setting.RevengePlugins]: RevengePluginsSetting,
    [Setting.RevengePluginsAdvanced]: RevengePluginsAdvancedSetting,
    [Setting.RevengePluginsBrowse]: RevengePluginsBrowseSetting,
})

// The settings plugin registers this section, and it always starts before us (we depend on it).
addSettingsItemToSection('REVENGE', Setting.RevengePlugins, 1)
