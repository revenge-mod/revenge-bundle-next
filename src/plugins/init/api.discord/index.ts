import defer * as DiscordActions from '@revenge-mod/discord/actions'
import defer * as DiscordCommon from '@revenge-mod/discord/common'
import { Logger } from '@revenge-mod/discord/common'
import defer * as DiscordDesign from '@revenge-mod/discord/design'
import defer * as DiscordFlux from '@revenge-mod/discord/flux'
import defer * as DiscordModulesMainTabsV2 from '@revenge-mod/discord/modules/main_tabs_v2'
import defer * as DiscordNative from '@revenge-mod/discord/native'
import { InternalPluginFlags, registerPlugin } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import {
    defineLazyProperties,
    defineLazyProperty,
} from '@revenge-mod/utils/object'
import type { PluginApiDiscord } from '@revenge-mod/discord/types/api'

registerPlugin(
    {
        id: 'revenge.api.discord',
        name: 'Discord API',
        description: '@revenge-mod/discord API for plugins.',
        author: 'Revenge',
        icon: 'PollsIcon',
    },
    {
        init({ unscoped, decorate }) {
            decorate(plugin => {
                defineLazyProperty(
                    plugin.api,
                    'logger',
                    () =>
                        new Logger(`Revenge > Plugins (${plugin.manifest.id})`),
                )
            })

            defineLazyProperties(
                (unscoped.discord = {
                    modules: defineLazyProperties(
                        {} as PluginApiDiscord.Modules,
                        {
                            mainTabsV2: () => {
                                return DiscordModulesMainTabsV2
                            },
                            settings: () => ({
                                ...require('@revenge-mod/discord/modules/settings'),
                                ...require('@revenge-mod/discord/modules/settings/renderer'),
                            }),
                        },
                    ),
                    utils: {
                        finders: require('@revenge-mod/discord/utils/modules/finders'),
                        metro: {
                            subscriptions: require('@revenge-mod/discord/utils/modules/metro/subscriptions'),
                        },
                    },
                } as PluginApiDiscord),
                {
                    actions: () => {
                        return DiscordActions
                    },
                    common: () => {
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
        },
    },
    PluginFlags.Enabled,
    // biome-ignore format: Don't format this
    InternalPluginFlags.Internal |
    InternalPluginFlags.Essential |
    InternalPluginFlags.API,
)
