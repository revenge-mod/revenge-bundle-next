// Type definitions for things in this codebase ONLY!

declare global {
    const __DEV__: boolean
    const __BUILD_DISCORD_SERVER_URL__: string
    const __BUILD_SOURCE_REPOSITORY_URL__: string
    const __BUILD_DEFAULT_PLUGIN_REPOSITORY_URL__: string | undefined
    const __BUILD_LICENSE_URL__: string
    const __BUILD_COMMIT__: string
    const __BUILD_BRANCH__: string
    const __BUILD_VERSION__: string

    /**
     * Whether to log promise rejections to the console.
     */
    const __BUILD_FLAG_LOG_PROMISE_REJECTIONS__: boolean
    /**
     * Whether to debug module lookups.
     *
     * - Logs successful lookups.
     * - Logs failed lookups with stack traces.
     * - Logs partial matches (matches exportless, but not with-exports).
     */
    const __BUILD_FLAG_DEBUG_MODULE_LOOKUPS__: boolean
    /**
     * Whether to debug lazy values.
     *
     * **This flag may break a lot of things depending on initialization timing. Use with caution.**
     *
     * - Immediately calls the signal to initialize proxified values.
     * - Immediately calls the loader to initialize lazy object properties.
     *
     * - Warns if the values are nullish.
     */
    const __BUILD_FLAG_DEBUG_LAZY_VALUES__: boolean
    /**
     * Whether to debug module waits.
     *
     * - Logs when a module is waited for.
     * - Logs when a module is found.
     */
    const __BUILD_FLAG_DEBUG_MODULE_WAITS__: boolean

    export interface ImportMeta {
        glob<T = any>(
            pattern: ImportMetaGlobPattern,
            options?: ImportMetaGlobOptions,
        ): Record<string, () => Promise<T>>
        glob<T = any>(
            pattern: ImportMetaGlobPattern,
            options: Extract<ImportMetaGlobOptions, { eager: true }>,
        ): Record<string, T>
    }
}

interface ImportMetaGlobOptions {
    eager?: boolean
    import?: string
    query?: string | Record<string, string>
}

type ImportMetaGlobPattern = string | string[]

export {}
