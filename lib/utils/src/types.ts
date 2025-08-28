export type Nullish = null | undefined
export type If<T, Then, Else> = T extends true ? Then : Else
export type AnyObject = Record<any, any>
export type LogicalOr<T1, T2> = T1 extends true
    ? true
    : T2 extends true
      ? true
      : false
export type LogicalAnd<T1, T2> = T1 extends true
    ? T2 extends true
        ? true
        : false
    : false
export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends AnyObject ? DeepPartial<T[K]> : T[K]
}
export type ExtractPredicate<T> = T extends (arg: any) => arg is infer R
    ? R
    : never

/// PLUGIN API EXTENSIONS

export interface PreInitPluginApiUtils {
    callback: typeof import('@revenge-mod/utils/callback')
    error: typeof import('@revenge-mod/utils/error')
    object: typeof import('@revenge-mod/utils/object')
    promise: typeof import('@revenge-mod/utils/promise')
    proxy: typeof import('@revenge-mod/utils/proxy')
    tree: typeof import('@revenge-mod/utils/tree')
}

export interface PluginApiUtils extends PreInitPluginApiUtils {
    react: typeof import('@revenge-mod/utils/react')
    discord: typeof import('@revenge-mod/utils/discord')
}

declare module '@revenge-mod/plugins/types' {
    export interface UnscopedPreInitPluginApi {
        utils: PreInitPluginApiUtils
    }

    export interface UnscopedInitPluginApi {
        utils: PluginApiUtils
    }
}
