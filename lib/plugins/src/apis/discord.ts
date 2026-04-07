import defer * as DiscordActions from '@revenge-mod/discord/actions'
import defer * as DiscordCommon from '@revenge-mod/discord/common'
import defer * as DiscordDesign from '@revenge-mod/discord/design'
import defer * as DiscordFlux from '@revenge-mod/discord/flux'
import defer * as DiscordModulesMainTabsV2 from '@revenge-mod/discord/modules/main_tabs_v2'
import defer * as DiscordNative from '@revenge-mod/discord/native'
import defer * as DiscordUtilsFinders from '@revenge-mod/discord/utils/modules/finders'
import defer * as DiscordUtilsMetroSubscriptions from '@revenge-mod/discord/utils/modules/metro/subscriptions'
import { defineLazyProperties } from '@revenge-mod/utils/object'
import { guardIndexInitialized } from '.'

export interface PluginApiDiscord {
    actions: PluginApiDiscord.Actions
    /**
     * This submodule is only available after the index module (ID 0) is initialized.
     * Attempting to access it before then will throw an error.
     */
    common: PluginApiDiscord.Common
    design: PluginApiDiscord.Design
    flux: PluginApiDiscord.Flux
    modules: PluginApiDiscord.Modules
    native: PluginApiDiscord.Native
    utils: PluginApiDiscord.Utils
}

export namespace PluginApiDiscord {
    export type Actions = typeof import('@revenge-mod/discord/actions')
    export type Common = typeof import('@revenge-mod/discord/common')
    export type Design = typeof import('@revenge-mod/discord/design')
    export type Flux = typeof import('@revenge-mod/discord/flux')
    export type Native = typeof import('@revenge-mod/discord/native')

    export interface Utils {
        finders: typeof import('@revenge-mod/discord/utils/modules/finders')
        metro: {
            subscriptions: typeof import('@revenge-mod/discord/utils/modules/metro/subscriptions')
        }
    }

    export interface Modules {
        mainTabsV2: typeof import('@revenge-mod/discord/modules/main_tabs_v2')
        settings: typeof import('@revenge-mod/discord/modules/settings') &
            typeof import('@revenge-mod/discord/modules/settings/renderer')
    }
}

export const discord = defineLazyProperties(
    {
        modules: defineLazyProperties({} as PluginApiDiscord.Modules, {
            mainTabsV2: () => {
                return DiscordModulesMainTabsV2
            },
            settings: () => ({
                ...require('@revenge-mod/discord/modules/settings'),
                ...require('@revenge-mod/discord/modules/settings/renderer'),
            }),
        }),
        utils: defineLazyProperties({} as PluginApiDiscord.Utils, {
            finders: () => {
                return DiscordUtilsFinders
            },
            metro: () => ({
                subscriptions: DiscordUtilsMetroSubscriptions,
            }),
        }),
    } as PluginApiDiscord,
    {
        actions: () => {
            return DiscordActions
        },
        common: () => {
            guardIndexInitialized('Discord.common')
            return DiscordCommon
        },
        flux: () => {
            return DiscordFlux
        },
        design: () => {
            return DiscordDesign
        },
        native: () => {
            return DiscordNative
        },
    },
)
