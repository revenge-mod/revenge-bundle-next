import type { FunctionComponent } from 'react'
import type {
    InitPluginApiDiscord,
    PreInitPluginApiDiscord,
} from './apis/discord'
import type { PluginApiExternals } from './apis/externals'
import type { PluginApiModules } from './apis/modules'
import type { PluginApiPlugins } from './apis/plugins'
import type { PluginApiReact } from './apis/react'

// biome-ignore lint/suspicious/noEmptyInterface: To be extended by actual extensions
export interface PluginApiExtensionsOptions {}

/** Unscoped plugin API available in the `preInit` lifecycle stage. */
export interface UnscopedPreInitPluginApi<
    // biome-ignore lint/correctness/noUnusedVariables: This is for plugin API extensions
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> {
    modules: PluginApiModules
    patcher: typeof import('@revenge-mod/patcher')
    plugins: PluginApiPlugins
    react: PluginApiReact
    assets: typeof import('@revenge-mod/assets')
    externals: PluginApiExternals
    /** Available in and after the `init` lifecycle stage. */
    components: unknown
    discord: PreInitPluginApiDiscord
}

/** Unscoped plugin API available in the `init` lifecycle stage. */
export interface UnscopedInitPluginApi<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends UnscopedPreInitPluginApi<O> {
    components: typeof import('@revenge-mod/components')
    discord: InitPluginApiDiscord
}

/** Unscoped plugin API available in the `start` and `stop` lifecycle stages. */
export interface UnscopedPluginApi<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends UnscopedInitPluginApi<O> {}

/** Plugin cleanup callback to be called when the plugin is stopped. */
export type PluginCleanup = () => any

/**
 * Registers cleanup callbacks to be called when the plugin is stopped.
 *
 * @example
 * ```ts
 * cleanup(unpatch)
 * cleanup(unsub)
 * ```
 */
export type PluginCleanupApi = (...fns: PluginCleanup[]) => void

/**
 * Registers an API decorator extending the plugin API for dependent plugins.
 *
 * @param decorator Decorator function modifying dependent plugin API.
 *
 * @example
 * ```ts
 * // Your plugin's `init` function:
 * init({ decorate }) {
 *   decorate((plugin, options) => {
 *     plugin.api.customMethod = () => {
 *       console.log('Custom method called!')
 *     }
 *
 *     // Optionally return a cleanup function to remove the decoration when the plugin is stopped.
 *     return () => {
 *       delete plugin.api.customMethod
 *     }
 *   })
 * }
 *
 * // In another plugin, with your plugin as a dependency:
 * init({ customMethod }) {
 *   customMethod() // Logs: "Custom method called!"
 * }
 * ```
 */
export type PluginDecorateApi<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
    S extends
        keyof PluginApiInLifecycleMap<O> = keyof PluginApiInLifecycleMap<O>,
> = (decorator: PluginApiDecorator<O, S>) => void | (() => unknown)

/**
 * Decorator callback that modifies the plugin API for dependents.
 *
 * @param plugin Target plugin instance.
 * @param options Plugin options.
 *
 * @see {@link PluginDecorateApi}
 */
export type PluginApiDecorator<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
    S extends
        keyof PluginApiInLifecycleMap<O> = keyof PluginApiInLifecycleMap<O>,
> = (plugin: Plugin<O, S>, options: O) => void

/** Plugin API available in the `preInit` lifecycle stage. */
export interface PreInitPluginApi<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> {
    decorate: PluginDecorateApi<O, 'PreInit'>
    unscoped: UnscopedPreInitPluginApi
    cleanup: PluginCleanupApi
    plugin: Plugin<O, 'PreInit'>
}

/** Plugin API available in the `init` lifecycle stage. */
export interface InitPluginApi<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends PreInitPluginApi<O> {
    decorate: PluginDecorateApi<O, 'Init'>
    unscoped: UnscopedInitPluginApi
    plugin: Plugin<O, 'Init'>
}

/** Plugin API available in the `start` and `stop` lifecycle stages. */
export interface PluginApi<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends InitPluginApi<O> {
    decorate: PluginDecorateApi<O, 'Start'>
    unscoped: UnscopedPluginApi
    plugin: Plugin<O, 'Start'>
}

export interface PluginManifest {
    /** Manifest schema format version. */
    format: number
    /** Unique plugin identifier. */
    id: string
    /** Display name. */
    name: string
    /** Author information. */
    author: string
    /** Plugin description. */
    description: string
    /** Plugin icon: asset name or `data:` URL. */
    icon?: string
    /** Dependencies keyed by plugin ID. */
    dependencies?: Record<string, PluginDependencyConstraint>
    /** Plugin version. */
    version: PluginVersion
}

export interface PluginVersion {
    nums: number[]
    label?: string
}

export interface PluginDependencyConstraint {
    /** Required version range. */
    version?: string
    /** Whether dependency is optional. */
    optional?: boolean
}

export interface PluginOptions<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends PluginLifecycles<O> {
    SettingsComponent?: PluginSettingsComponent<O>
}

/** Factory creating plugin options lazily to avoid evaluating code before execution is needed. */
export type PluginOptionsFactory<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> = () => PluginOptions<O>

export interface PluginLifecycles<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> {
    /**
     * Runs as soon as possible, before the index module (module 0)'s factory is run, with very limited APIs.
     */
    preInit?: (this: Plugin<O, 'PreInit'>, api: PreInitPluginApi<O>) => any
    /**
     * Runs after the index module (module 0)'s factory is run, with limited APIs.
     */
    init?: (this: Plugin<O, 'Init'>, api: InitPluginApi<O>) => any
    /** Runs during `AppRegistry.runApplication` with all APIs available. */
    start?: (this: Plugin<O, 'Start'>, api: PluginApi<O>) => any
    /** Runs when plugin is stopped. */
    stop?: (this: Plugin<O, 'Start'>, api: PluginApi<O>) => any
}

export interface Plugin<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
    S extends
        keyof PluginApiInLifecycleMap<O> = keyof PluginApiInLifecycleMap<O>,
> {
    manifest: PluginManifest
    lifecycles: PluginLifecycles<O>

    /**
     * Indicates whether plugin was started after initial startup sequence.
     * This can happen if the user just started the plugin in the UI.
     */
    startedLate: boolean
    /** Errors encountered during plugin execution. */
    errors: readonly unknown[]
    /**
     * Reports an error during plugin execution.
     *
     * Reporting errors won't disable the plugin.
     * You can call {@link Plugin.stop} or {@link Plugin.disable} if needed.
     */
    reportError(e: unknown): void

    SettingsComponent?: PluginSettingsComponent<O>

    /** Stops and disables the plugin. */
    disable(this: Plugin<O, S>): Promise<void>
    /** Stops the plugin. */
    stop(this: Plugin<O, S>): Promise<void>
    /** Marks plugin as requiring reload to apply changes. */
    requireReload(this: Plugin<O, S>): void

    /** Scoped plugin API instance. */
    api: PluginApiInLifecycleMap<O>[S]
}

/** Maps lifecycle stage names to scoped API types. */
export type PluginApiInLifecycleMap<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> = {
    Register: undefined
    PreInit: PreInitPluginApi<O>
    Init: InitPluginApi<O>
    Start: PluginApi<O>
}

/** React component rendering plugin settings UI. */
export interface PluginSettingsComponent<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends FunctionComponent<{ api: PluginApi<O> }> {}

declare module '@revenge-mod/modules/native' {
    export interface NativeMethods {
        'revenge.plugins.getConstants': [
            [],
            { storageRootPath: string; defaultsOnly: boolean },
        ]
    }
}
