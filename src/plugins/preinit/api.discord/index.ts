import { InternalPluginFlags, registerPlugin } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import { defineLazyProperty } from '@revenge-mod/utils/object'

registerPlugin(
    {
        id: 'revenge.api.discord',
        name: 'Discord API',
        description: '@revenge-mod/discord API for plugins.',
        author: 'Revenge',
        icon: 'PollsIcon',
    },
    {
        init({
            decorate,
            unscoped: {
                discord: {
                    common: { Logger },
                },
            },
        }) {
            decorate(plugin => {
                defineLazyProperty(
                    plugin.api,
                    'logger',
                    () =>
                        new Logger(`Revenge > Plugins (${plugin.manifest.id})`),
                )
            })
        },
    },
    PluginFlags.Enabled,
    // biome-ignore format: Don't format this
    InternalPluginFlags.Internal |
    InternalPluginFlags.Essential |
    InternalPluginFlags.API,
)
