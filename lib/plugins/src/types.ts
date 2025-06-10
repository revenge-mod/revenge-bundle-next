import type { Storage, StorageOptions } from '@revenge-mod/storage'
import type { AnyObject } from '@revenge-mod/utils/types'
import type { FunctionComponent } from 'react'
import type { PluginApiModules } from './apis/modules'
import type { PluginApiPlugins } from './apis/plugins'
import type { PluginApiReact } from './apis/react'
import type { PluginFlags, PluginStatus } from './constants'

/**
 * The unscoped plugin API (very limited). This API is available as a global for plugins.
 * Available in the `preInit` phase.
 */
export interface UnscopedPreInitPluginApi {
    modules: PluginApiModules
    patcher: typeof import('@revenge-mod/patcher')
    plugins: PluginApiPlugins
    // utils: PluginApiUtils
}

/**
 * The unscoped plugin API (limited). This API is available as a global for plugins.
 * Available in the `init` phase.
 */
export interface UnscopedInitPluginApi extends UnscopedPreInitPluginApi {
    assets: typeof import('@revenge-mod/assets')
    react: PluginApiReact
}

/**
 * The unscoped plugin API. This API is available as a global for plugins.
 * Available in the `start` and `stop` phase.
 */
export interface UnscopedPluginApi extends UnscopedInitPluginApi {
    // ui: typeof import('@revenge-mod/ui')
}

export type PluginCleanup = () => any
export type PluginCleanupApi = (...fns: PluginCleanup[]) => void

/**
 * The plugin API (very limited).
 * Available in the `preInit` phase.
 */
export interface PreInitPluginApi {
    unscoped: UnscopedPreInitPluginApi
    cleanup: PluginCleanupApi
    plugin: Plugin
}

/**
 * The plugin API (limited).
 * Available in the `init` phase.
 */
export interface InitPluginApi<S extends AnyObject = AnyObject>
    extends PreInitPluginApi {
    unscoped: UnscopedInitPluginApi
    /**
     * The plugin storage.
     *
     * Note that the instance is only created when the plugin accesses the API.
     * This is to prevent unnecessary storage instances from being created.
     *
     * To preload storage, simply call `api.storage.get()`.
     */
    storage: Storage<S>
}

/**
 * The plugin API.
 * Available in the `start` and `stop` phase.
 */
export interface PluginApi<S extends AnyObject = AnyObject>
    extends InitPluginApi<S> {
    unscoped: UnscopedPluginApi
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
}

export interface PluginOptions<S extends AnyObject = AnyObject>
    extends PluginLifecycles<S> {
    SettingsComponent?: PluginSettingsComponent<S>
    storage?: Omit<StorageOptions<S>, 'directory'>
}

export interface PluginLifecycles<S extends AnyObject = AnyObject> {
    /**
     * Runs as soon as possible with very limited APIs.
     * Before the index module (module 0)'s factory is run.
     *
     * @param api Plugin API (very limited).
     */
    preInit?: (api: PreInitPluginApi) => any
    /**
     * Runs as soon as all important modules are initialized.
     * After the index module (module 0)'s factory is run.
     *
     * @param api Plugin API (limited).
     */
    init?: (api: InitPluginApi<S>) => any
    /**
     * Runs when the plugin can be started with all APIs available.
     *
     * @param api Plugin API.
     */
    start?: (api: PluginApi<S>) => any
    /**
     * Runs when the plugin is stopped.
     *
     * @param api Plugin API.
     */
    stop?: (api: PluginApi<S>) => any
}

export interface Plugin<S extends AnyObject = AnyObject> {
    // TODO(plugins): support plugin bundles
    // /**
    //  * The plugin bundle this plugin belongs to.
    //  */
    // bundle: PluginBundle
    /**
     * The plugin manifest.
     */
    manifest: PluginManifest
    /**
     * The plugin lifecycles.
     */
    lifecycles: PluginLifecycles<S>

    /**
     * The plugin flags.
     * @see {@link PluginFlags}
     */
    flags: number
    /**
     * The plugin status.
     * @see {@link PluginStatus}
     */
    status: number
    /**
     * Errors encountered during the plugin lifecycles.
     */
    errors: unknown[]

    /**
     * The plugin settings page.
     */
    SettingsComponent?: PluginSettingsComponent<S>

    /**
     * Disable the plugin. This will also stop the plugin if it is running.
     */
    disable(): Promise<void>
    /**
     * Stop the plugin.
     */
    stop(): Promise<void>
}

export type PluginSettingsComponent<S extends AnyObject = AnyObject> =
    FunctionComponent<{ api: PluginApi<S> }>
