import defer * as DiscordActions from '@revenge-mod/discord/actions'
import defer * as DiscordCommonConstants from '@revenge-mod/discord/common/constants'
import defer * as DiscordCommonFlux from '@revenge-mod/discord/common/flux'
import defer * as DiscordCommonLogger from '@revenge-mod/discord/common/logger'
import defer * as DiscordCommonTokens from '@revenge-mod/discord/common/tokens'
import defer * as DiscordDesign from '@revenge-mod/discord/design'
import defer * as DiscordFlux from '@revenge-mod/discord/flux'
import defer * as DiscordModulesMainTabsV2 from '@revenge-mod/discord/modules/main_tabs_v2'
import defer * as DiscordNative from '@revenge-mod/discord/native'
import defer * as DiscordUtilsFinders from '@revenge-mod/discord/utils/modules/finders'
import defer * as DiscordUtilsMetroSubscriptions from '@revenge-mod/discord/utils/modules/metro/subscriptions'
import { defineLazyProperties } from '@revenge-mod/utils/object'
import { guardIndexInitialized } from '.'

export interface PreInitPluginApiDiscord {
    actions: PluginApiDiscord.Actions
    common: PreInitPluginApiDiscordCommon
    design: PluginApiDiscord.Design
    flux: PluginApiDiscord.Flux
    modules: PluginApiDiscord.Modules
    native: PluginApiDiscord.Native
    utils: PluginApiDiscord.Utils
}

export interface InitPluginApiDiscord extends PreInitPluginApiDiscord {
    common: InitPluginApiDiscordCommon
}

interface PreInitPluginApiDiscordCommon {
    appStartPerformance: typeof import('@revenge-mod/discord/common/app-start-performance')
    importTracker: typeof import('@revenge-mod/discord/common/import-tracker')
    utils: typeof import('@revenge-mod/discord/common/utils')
    /** This API is available in and after the `init` phase. */
    constants: unknown
    /** This API is available in and after the `init` phase. */
    flux: unknown
    /** This API is available in and after the `init` phase. */
    logger: unknown
    /** This API is available in and after the `init` phase. */
    tokens: unknown
}

interface InitPluginApiDiscordCommon extends PreInitPluginApiDiscordCommon {
    constants: typeof import('@revenge-mod/discord/common/constants')
    flux: typeof import('@revenge-mod/discord/common/flux')
    logger: typeof import('@revenge-mod/discord/common/logger')
    tokens: typeof import('@revenge-mod/discord/common/tokens')
}

export type PluginApiDiscord = PreInitPluginApiDiscord | InitPluginApiDiscord

export namespace PluginApiDiscord {
    export type Actions = typeof import('@revenge-mod/discord/actions')
    export type Common =
        | PreInitPluginApiDiscordCommon
        | InitPluginApiDiscordCommon
    export type Design = typeof import('@revenge-mod/discord/design')
    export type Flux = typeof import('@revenge-mod/discord/flux')
    export type Native = typeof import('@revenge-mod/discord/native')

    export interface Utils {
        modules: {
            finders: typeof import('@revenge-mod/discord/utils/modules/finders')
            metro: {
                subscriptions: typeof import('@revenge-mod/discord/utils/modules/metro/subscriptions')
            }
        }
    }

    export interface Modules {
        mainTabsV2: typeof import('@revenge-mod/discord/modules/main_tabs_v2')
        settings: typeof import('@revenge-mod/discord/modules/settings') & {
            renderer: typeof import('@revenge-mod/discord/modules/settings/renderer')
        }
    }
}

export const discord = defineLazyProperties(
    {
        common: defineLazyProperties(
            {
                appStartPerformance: require('@revenge-mod/discord/common/app-start-performance'),
                importTracker: require('@revenge-mod/discord/common/import-tracker'),
                utils: require('@revenge-mod/discord/common/utils'),
            } as InitPluginApiDiscordCommon,
            {
                constants: () => {
                    guardIndexInitialized('Discord.common.constants')
                    return DiscordCommonConstants
                },
                flux: () => {
                    guardIndexInitialized('Discord.common.flux')
                    return DiscordCommonFlux
                },
                logger: () => {
                    guardIndexInitialized('Discord.common.logger')
                    return DiscordCommonLogger
                },
                tokens: () => {
                    guardIndexInitialized('Discord.common.tokens')
                    return DiscordCommonTokens
                },
            },
        ),
        modules: defineLazyProperties({} as PluginApiDiscord.Modules, {
            mainTabsV2: () => {
                return DiscordModulesMainTabsV2
            },
            settings: () => ({
                ...require('@revenge-mod/discord/modules/settings'),
                renderer: require('@revenge-mod/discord/modules/settings/renderer'),
            }),
        }),
        utils: {
            modules: {
                finders: DiscordUtilsFinders,
                metro: {
                    subscriptions: DiscordUtilsMetroSubscriptions,
                },
            },
        },
    } as PluginApiDiscord,
    {
        actions: () => {
            guardIndexInitialized('Discord.actions')
            return DiscordActions
        },
        flux: () => {
            return DiscordFlux
        },
        design: () => {
            guardIndexInitialized('Discord.design')
            return DiscordDesign
        },
        native: () => {
            return DiscordNative
        },
    },
)
