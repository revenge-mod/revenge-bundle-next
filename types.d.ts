// Type definitions for things in this codebase ONLY!

declare global {
    const __BUILD_ENV__: 'development' | 'production'
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
     * - Logs failed lookups with stack traces.
     * - Logs partial matches (matches exportless, but not with-exports).
     */
    const __BUILD_FLAG_DEBUG_MODULE_LOOKUPS: boolean
    /**
     * Whether to debug proxified values.
     *
     * - Immediately calls the signal to initialize the proxified value.
     * - Warns if the proxified value is nullish.
     */
    const __BUILD_FLAG_DEBUG_PROXIFIED_VALUES: boolean

    // CommonJS modules, we don't want to depend on @types/node
    const module: {
        exports: any
    }

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
