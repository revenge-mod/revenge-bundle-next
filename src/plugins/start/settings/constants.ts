export const Setting = {
    // MAIN SETTINGS

    Revenge: 'Revenge',
    RevengePlugins: 'RevengePlugins',

    // SUBSETTINGS

    RevengeDiscord: 'RevengeDiscord',
    RevengeSourceRepository: 'RevengeSourceRepository',
    RevengeLicense: 'RevengeLicense',
    Reload: 'Reload',

    RevengeVersion: 'RevengeVersion',
    ReactVersion: 'ReactVersion',
    ReactNativeVersion: 'ReactNativeVersion',
    HermesVersion: 'HermesVersion',
    LoaderVersion: 'LoaderVersion',
} as const

export const RouteNames = {
    [Setting.Revenge]: 'Revenge',
    [Setting.RevengePlugins]: 'Revenge Plugins',
} as const
