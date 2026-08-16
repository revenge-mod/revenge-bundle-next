export const Setting = {
    // MAIN SETTINGS

    Revenge: 'Revenge',

    // SUBSETTINGS

    RevengeDiscord: 'RevengeDiscord',
    RevengeSourceRepository: 'RevengeSourceRepository',
    RevengeLicense: 'RevengeLicense',
    Reload: 'Reload',
    RevengeDeveloperMode: 'RevengeDeveloperMode',
    RevengeEnterRecoveryMode: 'RevengeEnterRecoveryMode',

    RevengeVersion: 'RevengeVersion',
    ReactVersion: 'ReactVersion',
    ReactNativeVersion: 'ReactNativeVersion',
    HermesVersion: 'HermesVersion',
    LoaderVersion: 'LoaderVersion',
} as const

export const RouteNames = {
    [Setting.Revenge]: 'Revenge',
} as const
