export const MobileSetting = {
    // MAIN SETTINGS

    REVENGE_DEVELOPER: 'REVENGE_DEVELOPER',

    // SUBSETTINGS

    REACT_DEVTOOLS_VERSION: 'REACT_DEVTOOLS_VERSION',
    REACT_DEVTOOLS_AUTO_CONNECT: 'REACT_DEVTOOLS_AUTO_CONNECT',
    REACT_DEVTOOLS_CONNECT: 'REACT_DEVTOOLS_CONNECT',
    REACT_DEVTOOLS_DISCONNECT: 'REACT_DEVTOOLS_DISCONNECT',
    EVALUATE_JAVASCRIPT: 'EVALUATE_JAVASCRIPT',
    ASSET_BROWSER: 'ASSET_BROWSER',
} as const

export const UserSettingsSections = {
    [MobileSetting.REVENGE_DEVELOPER]: 'Revenge Developer',
    [MobileSetting.ASSET_BROWSER]: 'Asset Browser',
} as const
