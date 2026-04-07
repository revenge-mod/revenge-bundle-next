import type { FunctionComponent } from 'react'
import type { PluginApiDiscord } from './apis/discord'
import type { PluginApiExternals } from './apis/externals'
import type { PluginApiModules } from './apis/modules'
import type { PluginApiPlugins } from './apis/plugins'
import type { PluginApiReact } from './apis/react'
import type { PluginFlags, PluginStatus } from './constants'

// biome-ignore lint/suspicious/noEmptyInterface: To be extended by actual extensions
export interface PluginApiExtensionsOptions {}

/**
 * The unscoped plugin API (very limited). This API is available as a global for plugins.
 * Available in the `preInit` phase.
 */
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
    components: typeof import('@revenge-mod/components')
    discord: PluginApiDiscord
}

/**
 * The unscoped plugin API (limited). This API is available as a global for plugins.
 * Available in the `init` phase.
 */
export interface UnscopedInitPluginApi<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends UnscopedPreInitPluginApi<O> {}

/**
 * The unscoped plugin API. This API is available as a global for plugins.
 * Available in the `start` and `stop` phase.
 */
export interface UnscopedPluginApi<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends UnscopedInitPluginApi<O> {}

/**
 * A cleanup function that can be registered to be called when the plugin is stopped.
 */
export type PluginCleanup = () => any
/**
 * Registers cleanup functions to be called when the plugin is stopped.
 *
 * @example
 * ```ts
 * cleanup(unpatch)
 * cleanup(unsub)
 * ```
 */
export type PluginCleanupApi = (...fns: PluginCleanup[]) => void

/**
 * Decorates the plugin API for the dependents of the plugin with a decorator function.
 * @param decorator The decorator function to apply.
 *
 * @example
 * ```ts
 * // Your plugin's `init` function:
 * init({ decorate }) {
 *   decorate((plugin, options) => {
 *     plugin.api.customMethod = () => {
 *       console.log('Custom method called!')
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
> = (decorator: PluginApiDecorator<O, S>) => void

/**
 * The decorator function that modifies the plugin API.
 *
 * @param plugin The plugin being decorated.
 * @param options The options the plugin passed.
 *
 * @see {@link PluginDecorateApi}
 */
export type PluginApiDecorator<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
    S extends
        keyof PluginApiInLifecycleMap<O> = keyof PluginApiInLifecycleMap<O>,
> = (plugin: Plugin<O, S>, options: O) => void

/**
 * The plugin API (very limited).
 * Available in the `preInit` phase.
 */
export interface PreInitPluginApi<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> {
    decorate: PluginDecorateApi<O, 'PreInit'>
    unscoped: UnscopedPreInitPluginApi
    cleanup: PluginCleanupApi
    plugin: Plugin<O, 'PreInit'>
}

/**
 * The plugin API (limited).
 * Available in the `init` phase.
 */
export interface InitPluginApi<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends PreInitPluginApi<O> {
    decorate: PluginDecorateApi<O, 'Init'>
    unscoped: UnscopedInitPluginApi
    plugin: Plugin<O, 'Init'>
}

/**
 * The plugin API.
 * Available in the `start` and `stop` phase.
 */
export interface PluginApi<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends InitPluginApi<O> {
    decorate: PluginDecorateApi<O, 'Start'>
    unscoped: UnscopedPluginApi
    plugin: Plugin<O, 'Start'>
}

// TODO(plugins): support plugin bundles
// export interface PluginBundle {
//     /**
//      * The unique identifier for the plugin bundle.
//      */
//     id: string
//     /**
//      * The author of the plugin bundle.
//      */
//     author: string
//     /**
//      * The URL of the plugin bundle.
//      */
//     url: string
// }

/**
 * The plugin manifest.
 */
export interface PluginManifest {
    /**
     * The unique identifier for the plugin.
     */
    id: string
    /**
     * The name of the plugin.
     */
    name: string
    /**
     * The author of the plugin.
     */
    author: string
    /**
     * The description of the plugin.
     */
    description: string
    /**
     * The icon of the plugin.
     */
    icon?: string
    /**
     * The dependencies of the plugin.
     */
    dependencies?: PluginDependency[]
}

export interface PluginDependency {
    /**
     * The ID of this dependency.
     */
    id: string
    // TODO(plugins): support plugin bundles
    // /**
    //  * The bundle of this dependency.
    //  */
    // bundle: PluginBundle
}

export interface PluginOptions<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends PluginLifecycles<O> {
    SettingsComponent?: PluginSettingsComponent<O>
}

/**
 * The plugin lifecycles.
 */
export interface PluginLifecycles<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> {
    /**
     * Runs as soon as possible with very limited APIs.
     * Before the index module (module 0)'s factory is run.
     *
     * @param api Plugin API (very limited).
     */
    preInit?: (this: Plugin<O, 'PreInit'>, api: PreInitPluginApi<O>) => any
    /**
     * Runs as soon as all important modules are initialized.
     * After the index module (module 0)'s factory is run.
     *
     * @param api Plugin API (limited).
     */
    init?: (this: Plugin<O, 'Init'>, api: InitPluginApi<O>) => any
    /**
     * Runs when the plugin can be started with all APIs available.
     *
     * @param api Plugin API.
     */
    start?: (this: Plugin<O, 'Start'>, api: PluginApi<O>) => any
    /**
     * Runs when the plugin is stopped.
     *
     * @param api Plugin API.
     */
    stop?: (this: Plugin<O, 'Start'>, api: PluginApi<O>) => any
}

export interface Plugin<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
    S extends
        keyof PluginApiInLifecycleMap<O> = keyof PluginApiInLifecycleMap<O>,
> {
    // TODO(plugins): support plugin bundles
    // /**
    //  * The plugin bundle this plugin belongs to.
    //  */
    // bundle: PluginBundle
    manifest: PluginManifest
    lifecycles: PluginLifecycles<O>

    /**
     * @see {@link PluginFlags}
     */
    flags: number
    /**
     * @see {@link PluginStatus}
     */
    status: number
    /**
     * Errors encountered during the plugin lifecycles.
     */
    errors: unknown[]

    SettingsComponent?: PluginSettingsComponent<O>

    /**
     * Disable the plugin.
     * This will also stop the plugin if it is running.
     */
    disable(this: Plugin<O, S>): Promise<void>
    /**
     * Stop the plugin.
     */
    stop(this: Plugin<O, S>): Promise<void>

    /**
     * The plugin API.
     *
     * Not recommended to use this directly.
     */
    api: PluginApiInLifecycleMap<O>[S]
}

/**
 * The plugin API in a specific stage.
 */
export type PluginApiInLifecycleMap<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> = {
    Register: undefined
    PreInit: PreInitPluginApi<O>
    Init: InitPluginApi<O>
    Start: PluginApi<O>
}

/**
 * The component that renders the plugin settings page.
 */
export interface PluginSettingsComponent<
    O extends PluginApiExtensionsOptions = PluginApiExtensionsOptions,
> extends FunctionComponent<{ api: PluginApi<O> }> {}
