/**
 * The hidden API. Anything in here can change or disappear in any build.
 *
 * Everything here is internal state of the loader and its libraries.
 * It exists so you can look at what Revenge is doing at runtime.
 *
 * Namespaces are lazy, so reading one before its library is ready may throw (e.g. Discord ones need the index module).
 */
export interface HiddenApi {
    assets: HiddenApiAssets
    /** `@revenge-mod/components`' shared styles. */
    components: typeof import('../../components/src/_internal')
    discord: HiddenApiDiscord
    /** Read-only conveniences built on top of the namespaces below. */
    helpers: typeof import('./helpers')
    modules: HiddenApiModules
    /** Patch topology: proxy states, the proxy handler, (un)proxy internals. */
    patcher: typeof import('../../patcher/src/_internal')
    plugins: HiddenApiPlugins
    react: HiddenApiReact
}

export interface HiddenApiPlugins {
    /** The unscoped API object plugins get, and its guards. */
    apis: typeof import('../../plugins/src/apis/index')
    /** API decorator stores, keyed per lifecycle. */
    decorators: typeof import('../../plugins/src/_internal/decorators')
    /** Start ordering: node sets, the pending queue, reserved dependency IDs. */
    dependencyGraph: typeof import('../../plugins/src/_internal/dependency-graph')
    /** Bridge consumers for natively-managed plugins (install, uninstall, sync). */
    externalPlugins: typeof import('../../plugins/src/_internal/external-plugins')
    /** The plugin registry, emitter, flags and lifecycle runners. */
    internal: typeof import('../../plugins/src/_internal/index')
    /** Repository listing, resolution and install execution. */
    repositories: typeof import('../../plugins/src/_internal/repositories')
}

export interface HiddenApiModules {
    /** The persisted module find cache and its writers. */
    caches: typeof import('../../modules/src/caches')
    /** Filter running, result flags and the no-default-export cache. */
    finders: typeof import('../../modules/src/finders/_internal')
    metro: HiddenApiModulesMetro
    /** The registry of JS methods native can call. */
    native: typeof import('../../modules/src/native/_internal')
}

export interface HiddenApiModulesMetro {
    /** The module table itself: `mList`, initialized/uninitialized sets, deps, segments. */
    patches: typeof import('../../modules/src/metro/patches')
    /** Our `__r` implementation, the module flag bits and `mErrorChain`. */
    runtime: typeof import('../../modules/src/metro/runtime')
    /** Module require/initialize subscription sets. */
    subscriptions: typeof import('../../modules/src/metro/subscriptions/_internal')
}

export interface HiddenApiDiscord {
    /** Flux dispatch interceptors, per event type and for all events. */
    flux: typeof import('../../discord/src/patches/flux')
    /** The source path to module ID index. */
    importTracker: typeof import('../../discord/src/patches/import-tracker')
    /** Injected settings items/sections and the refresh counters. */
    settings: typeof import('../../discord/src/modules/settings/_internal')
}

export interface HiddenApiReact {
    /** Element type patches applied on every `jsx()` call. */
    jsxRuntime: typeof import('../../react/src/jsx-runtime/_internal')
    /** `runApplication` callback sets. */
    native: typeof import('../../react/src/native/_internal')
}

export interface HiddenApiAssets {
    /** The persisted asset name to module ID cache. */
    caches: typeof import('../../assets/src/caches')
    /** Registered custom assets and asset overrides. */
    internal: typeof import('../../assets/src/_internal')
}

declare module '@revenge-mod/plugins/types' {
    interface UnscopedPreInitPluginApi {
        hidden?: HiddenApi
    }
}
