import * as PluginApiModulesFinders_ from '@revenge-mod/modules/finders'
import * as PluginApiModulesFindersFilters from '@revenge-mod/modules/finders/filters'
import * as PluginApiModulesMetroSubscriptions from '@revenge-mod/modules/metro/subscriptions'
import * as PluginApiModulesMetroUtils from '@revenge-mod/modules/metro/utils'
import * as PluginApiModulesNative_ from '@revenge-mod/modules/native'
import * as PluginApiModulesNativeFileSystem from '@revenge-mod/modules/native/fs'
import { spreadDescriptors } from '.'

export interface PluginApiModules {
    finders: PluginApiModulesFinders
    metro: PluginApiModulesMetro
    native: PluginApiModulesNative
}

export type PluginApiModulesNative = typeof PluginApiModulesNative_ & {
    fs: typeof PluginApiModulesNativeFileSystem
}

export type PluginApiModulesMetro =
    // biome-ignore format: Don't
    typeof PluginApiModulesMetroUtils &
    typeof PluginApiModulesMetroSubscriptions

export type PluginApiModulesFinders = typeof PluginApiModulesFinders_ & {
    filters: typeof PluginApiModulesFindersFilters
}

export const modules: PluginApiModules = {
    finders: spreadDescriptors(PluginApiModulesFinders_, {
        filters: PluginApiModulesFindersFilters,
    }),
    metro: spreadDescriptors(
        PluginApiModulesMetroUtils,
        spreadDescriptors(PluginApiModulesMetroSubscriptions, {}),
    ),
    native: spreadDescriptors(PluginApiModulesNative_, {
        fs: PluginApiModulesNativeFileSystem,
    }),
}
