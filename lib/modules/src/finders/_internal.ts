import { getCurrentStack } from '@revenge-mod/utils/error'
import { cacheFilterResultForId } from '../caches'
import { metroRequire } from '../metro/custom'
import { mInitialized } from '../metro/patches'
import { isModuleExportBad } from '../metro/utils'
import type { If } from '@revenge-mod/utils/types'
import type { Metro } from '../types'
import type { Filter } from './filters'

export interface RunFilterOptions {
    /**
     * Whether to skip checking the default export.
     *
     * @default false
     */
    skipDefault?: boolean
    /**
     * Whether to allow initializing modules to check their exports.
     *
     * @default true
     */
    initialize?: boolean
}

export type RunFilterReturnExportsOptions<
    ReturnNamespace extends boolean = boolean,
> = RunFilterOptions &
    If<
        ReturnNamespace,
        {
            /**
             * Whether to return the whole module with all exports instead of just the default export **if the default export matches**.
             *
             * @default false
             */
            returnNamespace: true
        },
        {
            returnNamespace?: false
        }
    >

export const FilterResultFlags = {
    /**
     * A module was found, without exports filtering.
     */
    Found: 1,
    /**
     * A module was found, and the filter matched the default export.
     */
    Default: 2,
    /**
     * A module was found, and the filter matched the module namespace.
     */
    Namespace: 3,
}

export type FilterResultFlag =
    (typeof FilterResultFlags)[keyof typeof FilterResultFlags]

export const FilterResultFlagToHumanReadable: Record<FilterResultFlag, string> =
    {
        [FilterResultFlags.Default]: '\u001b[94mdefault\u001b[0m',
        [FilterResultFlags.Namespace]: '\u001b[35mnamespace\u001b[0m',
        [FilterResultFlags.Found]: '\u001b[96mexportsless\u001b[0m',
    }

// The reason this returns a flag is because flags are never falsy, while exports may be falsy when using ID-only filters (eg. `withDependencies`).

// Currently, we only have options that are relevant for checking exports
// If we add more options later on, do NOT forget about
// adding them here, and passing them in the lookup* functions
export function runFilter(
    filter: Filter<any, false>,
    id: Metro.ModuleID,
): FilterResultFlag | undefined

export function runFilter(
    filter: Filter,
    id: Metro.ModuleID,
    exports: Metro.ModuleExports,
    options?: RunFilterOptions,
): FilterResultFlag | undefined

export function runFilter(
    filter: Filter,
    id: Metro.ModuleID,
    exports?: Metro.ModuleExports,
    options?: RunFilterOptions,
): FilterResultFlag | undefined {
    if (exports === undefined) {
        if ((filter as Filter<any, false>)(id)) {
            if (options?.initialize ?? true) {
                const module = metroRequire(id)
                // Check if the required module is not blacklisted
                if (mInitialized.has(id)) {
                    if (__BUILD_FLAG_DEBUG_MODULE_LOOKUPS__) {
                        const flag = runFilter(filter, id, module, options)
                        if (!flag) DEBUG_warnPartialFilterMatch(id, filter.key)
                        return flag
                    } else return runFilter(filter, id, module, options)
                } else return
            }

            return FilterResultFlags.Found
        }

        return
    }

    if (filter(id, exports))
        return cacheFilterResultForId(
            filter.key,
            id,
            FilterResultFlags.Namespace,
        )

    if (options?.skipDefault) return

    const { default: defaultExport } = exports
    if (!isModuleExportBad(defaultExport) && filter(id, defaultExport))
        return cacheFilterResultForId(filter.key, id, FilterResultFlags.Default)
}

export function exportsFromFilterResultFlag(
    flag: FilterResultFlag,
    exports: Metro.ModuleExports,
    options?: RunFilterReturnExportsOptions,
) {
    if (flag === FilterResultFlags.Default && !options?.returnNamespace)
        return exports.default
    return exports
}

/**
 * Warns the developer that the filter matched during exportsless comparison, but not during the full comparison.
 * This will cause modules to be initialized unnecessarily, and may cause issues.
 */
function DEBUG_warnPartialFilterMatch(id: Metro.ModuleID, key: string) {
    nativeLoggingHook(
        `\u001b[33m${key} matched module ${id} partially.\n${getCurrentStack()}\u001b[0m`,
        2,
    )
}
