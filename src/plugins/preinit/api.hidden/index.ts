import { hiddenApi } from '@revenge-mod/hidden'
import {
    InternalPluginFlags,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'

const pluginHiddenApi = registerInternalPlugin(
    {
        id: 'revenge.api.hidden',
        name: 'Developer Mode',
        description: 'Exposes internal Revenge APIs for debugging.',
        author: 'Revenge',
        icon: 'WrenchIcon',
    },
    {
        preInit({ cleanup, unscoped }) {
            unscoped.hidden = hiddenApi

            cleanup(() => {
                // biome-ignore lint/performance/noDelete: We want to remove the API completely
                delete unscoped.hidden
            })
        },
    },
    // Dev builds always get it, release builds go through the settings toggle.
    __DEV__ ? PluginFlags.Enabled : 0,
    InternalPluginFlags.Internal,
)

export default pluginHiddenApi
