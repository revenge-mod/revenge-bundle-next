import type { RouteNames, Setting } from './constants'

declare module '@revenge-mod/externals/react-navigation' {
    interface ReactNavigationParamList extends RevengeSettingsParamList {}
}

type RevengeSettingsParamList = {
    [K in (typeof RouteNames)[keyof typeof RouteNames]]: object
} & {
    [K in (typeof RouteNames)[(typeof Setting)['RevengePlugins']]]: {
        sort?: string
        filter?: string[]
        matchAll?: boolean
        reverse?: boolean
    }
}
