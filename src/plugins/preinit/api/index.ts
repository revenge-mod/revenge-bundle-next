import {
    InternalPluginFlags,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import defer * as Discord from './discord'
import defer * as JsonStorage from './json-storage'

registerInternalPlugin(
    {
        id: 'revenge.api',
        name: 'Plugin API',
        description: 'Provides the Revenge plugin API.',
        author: 'Revenge',
        icon: 'PollsIcon',
    },
    {
        preInit(api) {
            JsonStorage.preInit(api)
        },
        init(api) {
            JsonStorage.init(api)
            Discord.init(api)
        },
    },
    PluginFlags.Enabled,
    // biome-ignore format: Don't format this
    InternalPluginFlags.Internal |
    InternalPluginFlags.Essential |
    InternalPluginFlags.API,
)
