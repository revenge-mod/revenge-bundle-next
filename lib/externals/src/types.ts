export interface PluginApiExternals {
    Browserify: typeof import('@revenge-mod/externals/browserify')
    ReactNativeClipboard: typeof import('@revenge-mod/externals/react-native-clipboard')
    ReactNativeSafeAreaContext: typeof import('@revenge-mod/externals/react-native-safe-area-context')
    ReactNavigation: typeof import('@revenge-mod/externals/react-navigation')
    Shopify: typeof import('@revenge-mod/externals/shopify')
}

declare module '@revenge-mod/plugins/types' {
    export interface UnscopedInitPluginApi {
        externals: PluginApiExternals
    }
}
