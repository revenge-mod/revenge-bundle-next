import { getCurrentStack } from '@revenge-mod/utils/error'
import { proxify } from '@revenge-mod/utils/proxy'
import { cacheFilterNotFound, getCachedFilterRegistry } from '../caches'
import {
    mImportedPaths,
    mInitialized,
    mList,
    mUninitialized,
} from '../metro/patches'
import {
    getInitializedModuleExports,
    isModuleInitialized,
} from '../metro/utils'
import {
    exportsFromFilterResultFlag,
    FilterResultFlagToHumanReadable,
    runFilter,
} from './_internal'
import type { If, Nullish } from '@revenge-mod/utils/types'
import type { MaybeDefaultExportMatched, Metro } from '../types'
import type {
    FilterResultFlag,
    RunFilterReturnExportsOptions,
} from './_internal'
import type { Filter, FilterResult } from './filters'

type LookupModulesOptionsWithAll<A extends boolean> = If<
    A,
    {
        /**
         * Whether to include all modules in the lookup, including blacklisted ones.
         *
         * **This overrides {@link BaseLookupModulesOptions.initialized} and {@link BaseLookupModulesOptions.uninitialized}.**
         */
        all: A
    },
    {
        /**
         * You can only use `all` with exportsless filters!
         */
        all?: false
    }
>

type LookupModulesOptionsWithInitializedUninitialized<U extends boolean> = {
    /**
     * Whether to include initialized modules in the lookup.
     *
     * @default true
     */
    initialized?: boolean
} & If<
    U,
    {
        /**
         * Whether to include uninitialized modules in the lookup.
         *
         * Set {@link BaseLookupModulesOptions.initialize} `true` to initialize uninitialized modules.
         *
         * @default false
         */
        uninitialized: U
    },
    {
        /**
         * You can only use `uninitialized` with exportsless filters!
         */
        uninitialized?: false
    }
>

export type LookupModulesOptions<
    ReturnNamespace extends boolean = boolean,
    Uninitialized extends boolean = boolean,
    All extends boolean = boolean,
    Initialize extends boolean = boolean,
> = RunFilterReturnExportsOptions<ReturnNamespace> & {
    /**
     * Whether to use cached lookup results.
     */
    cached?: boolean
} & If<
        Initialize,
        {
            /**
             * Whether to initialize matching uninitialized modules.
             *
             * **This will initialize any modules that match the exportsless filter and may cause unintended side effects.**
             */
            initialize?: Initialize
        },
        {
            initialize: false
        }
    > &
    If<
        All,
        LookupModulesOptionsWithAll<All> & {
            [K in keyof LookupModulesOptionsWithInitializedUninitialized<Uninitialized>]?: never
        },
        LookupModulesOptionsWithInitializedUninitialized<Uninitialized> & {
            [K in keyof LookupModulesOptionsWithAll<All>]?: never
        }
    >

export type LookupModulesResult<
    F extends Filter,
    O extends LookupModulesOptions,
> = [
    exports: O extends LookupModulesOptions<boolean, boolean, boolean, false>
        ? LookupFilterResult<F, O> | Nullish
        : LookupFilterResult<F, O>,
    id: Metro.ModuleID,
]

type LookupFilterResult<
    F extends Filter,
    O extends LookupModulesOptions,
> = O extends RunFilterReturnExportsOptions<true>
    ? MaybeDefaultExportMatched<FilterResult<F>>
    : FilterResult<F>

const NotFoundResult: [] = []

type LookupNotFoundResult = typeof NotFoundResult

/**
 * Lookup modules.
 *
 * You can lookup uninitialized modules by passing `options.uninitialized` when filtering via exportsless filters (eg. `byDependencies`).
 * Use the `moduleStateAware` helper to filter dynamically based on whether the module is initialized or not.
 *
 * @param filter The filter to use.
 * @param options The options to use for the lookup.
 * @returns A generator that yields the module exports that match the filter.
 *
 * @example
 * ```ts
 * const lookup = lookupModules(byProps('x'))
 * // Log all module exports that has exports.x
 * for (const exports of lookup) console.log(exports)
 * ```
 */
export function lookupModules<F extends Filter>(
    filter: F,
): Generator<LookupModulesResult<F, object>, undefined>

export function lookupModules<
    F extends Filter,
    const O extends F extends Filter<any, infer WE>
        ? If<
              WE,
              LookupModulesOptions<boolean, false, false>,
              LookupModulesOptions
          >
        : never,
>(filter: F, options: O): Generator<LookupModulesResult<F, O>, undefined>

export function* lookupModules(filter: Filter, options?: LookupModulesOptions) {
    let notFound = true
    let cached: Set<Metro.ModuleID> | undefined

    if (options?.cached ?? true) {
        const notInit = !(options?.initialize ?? true)

        const reg = getCachedFilterRegistry(filter.key)
        // Return early if previous lookup was a full lookup and no modules were found
        if (reg === null) return

        if (reg) {
            cached = new Set()

            for (const sId in reg) {
                const flag = reg[sId]
                const id = Number(sId)
                let exports: Metro.ModuleExports | undefined

                if (isModuleInitialized(id))
                    exports = getInitializedModuleExports(id)
                else {
                    if (notInit) continue
                    exports = __r(id)
                }

                cached.add(id)

                if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__)
                    DEBUG_logLookupMatched(filter.key, flag, id, true)

                yield [exportsFromFilterResultFlag(flag, exports, options), id]
            }
        }
    }

    // Full lookup
    if (options?.all) {
        for (const id of mList.keys()) {
            if (cached?.has(id)) continue

            const exports = getInitializedModuleExports(id)
            const flag = runFilter(filter, id, exports, options)
            if (flag) {
                notFound = false

                if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__)
                    DEBUG_logLookupMatched(filter.key, flag, id)

                yield [exportsFromFilterResultFlag(flag, exports, options), id]
            }
        }

        if (notFound) cacheFilterNotFound(filter.key) // Full lookup, and still not found!
    }
    // Partial lookup
    else {
        if (options?.initialized ?? true)
            for (const id of mInitialized) {
                if (cached?.has(id)) continue

                const exports = getInitializedModuleExports(id)
                const flag = runFilter(filter, id, exports, options)
                if (flag) {
                    notFound = false

                    if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__)
                        DEBUG_logLookupMatched(filter.key, flag, id)

                    yield [
                        exportsFromFilterResultFlag(flag, exports, options),
                        id,
                    ]
                }
            }

        if (options?.uninitialized)
            for (const id of mUninitialized) {
                if (cached?.has(id)) continue

                const flag = runFilter(filter, id, undefined, options)
                if (flag) {
                    notFound = false

                    if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__)
                        DEBUG_logLookupMatched(filter.key, flag, id)

                    yield [
                        exportsFromFilterResultFlag(
                            flag,
                            getInitializedModuleExports(id),
                            options,
                        ),
                        id,
                    ]
                }
            }
    }

    if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__)
        if (notFound) DEBUG_warnLookupNoMatch(filter.key)
}

/**
 * Lookup a module. Skipping creating a `Generator`.
 *
 * @see {@link lookupModules} for more documentation.
 *
 * @param filter The filter to use.
 * @param options The options to use for the lookup.
 * @returns The first module exports that match the filter.
 *
 * @example
 * ```ts
 * const React = lookupModule(byProps<typeof import('react')>('createElement'))
 * ```
 */
export function lookupModule<F extends Filter>(
    filter: F,
): LookupModulesResult<F, object> | LookupNotFoundResult

export function lookupModule<
    F extends Filter,
    const O extends F extends Filter<any, infer WE>
        ? If<
              WE,
              LookupModulesOptions<boolean, false, false>,
              LookupModulesOptions
          >
        : never,
>(filter: F, options: O): LookupModulesResult<F, O> | LookupNotFoundResult

export function lookupModule(filter: Filter, options?: LookupModulesOptions) {
    if (options?.cached ?? true) {
        const notInit = !(options?.initialize ?? true)

        const reg = getCachedFilterRegistry(filter.key)
        // Return early if previous lookup was a full lookup and no modules were found
        if (reg === null) return NotFoundResult

        if (reg)
            for (const sId in reg) {
                const flag = reg[sId]
                const id = Number(sId)
                let exports: Metro.ModuleExports

                if (isModuleInitialized(id))
                    exports = getInitializedModuleExports(id)
                else {
                    if (notInit) continue
                    exports = __r(id)
                }

                if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__)
                    DEBUG_logLookupMatched(filter.key, flag, id, true)

                return [exportsFromFilterResultFlag(flag, exports, options), id]
            }
    }

    // Full lookup
    if (options?.all) {
        for (const id of mList.keys()) {
            const exports = getInitializedModuleExports(id)
            const flag = runFilter(filter, id, exports, options)
            if (flag) {
                if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__)
                    DEBUG_logLookupMatched(filter.key, flag, id)

                return [exportsFromFilterResultFlag(flag, exports, options), id]
            }
        }

        if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__)
            DEBUG_warnLookupNoMatch(filter.key)

        cacheFilterNotFound(filter.key) // Full lookup, and still not found!

        return NotFoundResult
    }
    // Partial lookup
    else {
        if (options?.initialized ?? true)
            for (const id of mInitialized) {
                const exports = getInitializedModuleExports(id)
                const flag = runFilter(filter, id, exports, options)
                if (flag) {
                    if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__)
                        DEBUG_logLookupMatched(filter.key, flag, id)

                    return [
                        exportsFromFilterResultFlag(flag, exports, options),
                        id,
                    ]
                }
            }

        if (options?.uninitialized)
            for (const id of mUninitialized) {
                const flag = runFilter(filter, id, undefined, options)
                if (flag) {
                    if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__)
                        DEBUG_logLookupMatched(filter.key, flag, id)

                    return [
                        exportsFromFilterResultFlag(
                            flag,
                            getInitializedModuleExports(id),
                            options,
                        ),
                        id,
                    ]
                }
            }
    }

    if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__) DEBUG_warnLookupNoMatch(filter.key)

    return NotFoundResult
}

/**
 * Lookup an initialized module by its imported path.
 *
 * Think of it as if you are doing a `import * as exports from path`, the app must have already initialized the module or this will return `undefined`.
 *
 * @param path The path to lookup the module by.
 * @returns The module exports if the module is initialized, or `undefined` if the module is not found or not initialized.
 *
 * @example
 * ```ts
 * const [{ default: Logger }] = lookupModuleByImportedPath<{ default: typeof DiscordModules.Logger }>('modules/debug/Logger.tsx')
 * ```
 */
export function lookupModuleByImportedPath<T = any>(
    path: string,
): [exports: T, id: Metro.ModuleID] | [] {
    const id = mImportedPaths.get(path)
    if (id == null) return NotFoundResult

    return [getInitializedModuleExports(id), id]
}

const __DEBUG_TRACER_IGNORE_LIST__ = __BUILD_FLAG_DEBUG_MODULE_LOOKUPS__
    ? proxify(
          () => [
              require('./get').getModule,
              isModuleInitialized(0) &&
                  require('@revenge-mod/utils/discord')
                      .lookupGeneratedIconComponent,
          ],
          { hint: [] },
      )
    : []

/**
 * Logs to the developer that a module was found, how it is found, and whether it was a cached result.
 */
function DEBUG_logLookupMatched(
    key: string,
    flag: FilterResultFlag,
    id: Metro.ModuleID,
    cached?: boolean,
) {
    nativeLoggingHook(
        `\u001b[32mSuccessful lookup: \u001b[33m${key}\u001b[0m (matched ${id}, ${FilterResultFlagToHumanReadable[flag]}${cached ? ', \u001b[92mcached\u001b[0m' : ''})`,
        1,
    )
}

/**
 * Warns the developer that no module was found for the given filter.
 * This is useful for debugging purposes, especially when using filters that are expected to match a module.
 */
function DEBUG_warnLookupNoMatch(key: string) {
    const stack = getCurrentStack()
    for (const func of __DEBUG_TRACER_IGNORE_LIST__)
        if (stack.includes(func.name)) return

    nativeLoggingHook(`\u001b[31mFailed lookup: ${key}\n${stack}\u001b[0m`, 2)
}
