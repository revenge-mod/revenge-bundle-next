import {
    InternalPluginFlags,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import defer * as Discord from './discord'
import defer * as JsonStorage from './json-storage'
import manifest from './manifest.json'

registerInternalPlugin(
    manifest,
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
