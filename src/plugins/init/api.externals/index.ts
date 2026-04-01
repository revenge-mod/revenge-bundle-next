import defer * as Browserify from '@revenge-mod/externals/browserify'
import defer * as ReactNativeClipboard from '@revenge-mod/externals/react-native-clipboard'
import defer * as ReactNativeSafeAreaContext from '@revenge-mod/externals/react-native-safe-area-context'
import defer * as ReactNavigation from '@revenge-mod/externals/react-navigation'
import defer * as Shopify from '@revenge-mod/externals/shopify'
import { InternalPluginFlags, registerPlugin } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import { defineLazyProperties } from '@revenge-mod/utils/object'
import type { PluginApiExternals } from '@revenge-mod/externals/types'

registerPlugin(
    {
        id: 'revenge.api.externals',
        name: 'Externals API',
        description: '@revenge-mod/externals API for plugins.',
        author: 'Revenge',
        icon: 'PollsIcon',
    },
    {
        init({ unscoped }) {
            defineLazyProperties(
                (unscoped.externals = {} as PluginApiExternals),
                {
                    Browserify: () => {
                        return Browserify
                    },
                    ReactNativeClipboard: () => {
                        return ReactNativeClipboard
                    },
                    ReactNativeSafeAreaContext: () => {
                        return ReactNativeSafeAreaContext
                    },
                    ReactNavigation: () => {
                        return ReactNavigation
                    },
                    Shopify: () => {
                        return Shopify
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
