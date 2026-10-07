import defer * as Browserify from '@revenge-mod/externals/browserify'
import defer * as Gorhom from '@revenge-mod/externals/gorhom'
import defer * as ReactNativeClipboard from '@revenge-mod/externals/react-native-clipboard'
import defer * as ReactNativeCommunity from '@revenge-mod/externals/react-native-community'
import defer * as ReactNativeSafeAreaContext from '@revenge-mod/externals/react-native-safe-area-context'
import defer * as ReactNavigation from '@revenge-mod/externals/react-navigation'
import defer * as Shopify from '@revenge-mod/externals/shopify'
import { defineLazyProperties } from '@revenge-mod/utils/object'

export interface PluginApiExternals {
    Browserify: typeof import('@revenge-mod/externals/browserify')
    Gorhom: typeof import('@revenge-mod/externals/gorhom')
    ReactNativeClipboard: typeof import('@revenge-mod/externals/react-native-clipboard')
    ReactNativeCommunity: typeof import('@revenge-mod/externals/react-native-community')
    ReactNativeSafeAreaContext: typeof import('@revenge-mod/externals/react-native-safe-area-context')
    ReactNavigation: typeof import('@revenge-mod/externals/react-navigation')
    Shopify: typeof import('@revenge-mod/externals/shopify')
}

export const externals: PluginApiExternals = defineLazyProperties(
    {} as PluginApiExternals,
    {
        Browserify: () => {
            return Browserify
        },
        Gorhom: () => {
            return Gorhom
        },
        ReactNativeClipboard: () => {
            return ReactNativeClipboard
        },
        ReactNativeCommunity: () => {
            return ReactNativeCommunity
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
