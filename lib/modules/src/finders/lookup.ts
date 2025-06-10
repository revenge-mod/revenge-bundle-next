import { _inits, _paths, _uninits } from '../metro/_internal'
import { getInitializedModuleExports } from '../metro/utils'
import { exportsFromFilterResultFlag, runFilter } from './_internal'
import type { If } from '@revenge-mod/utils/types'
import type { MaybeDefaultExportMatched, Metro } from '../types'
import type {
    RunFilterOptions,
    RunFilterReturnExportsOptions,
} from './_internal'
import type { Filter, FilterResult } from './filters'

export interface BaseLookupModulesOptions<
    IncludeUninitialized extends boolean = boolean,
> extends RunFilterOptions {
    /**
     * Whether to include initialized modules in the lookup.
     *
     * @default true
     */
    includeInitialized?: boolean
    /**
     * Whether to include uninitialized modules in the lookup.
     *
     * Options that require modules to be initialized (eg. `returnNamespace`, `skipDefault`) will be ignored during uninitialized module ID lookup.
     *
     * **This will initialize any modules that match the filter and may cause unintended side effects.**
     *
     * @default false
     */
    includeUninitialized?: IncludeUninitialized
}

export type LookupModulesOptions<
    ReturnNamespace extends boolean = boolean,
    IncludeUninitialized extends boolean = boolean,
> = RunFilterReturnExportsOptions<ReturnNamespace> &
    BaseLookupModulesOptions<IncludeUninitialized>

export type LookupModulesResult<
    F extends Filter,
    O extends LookupModulesOptions,
> = [
    exports: O extends RunFilterReturnExportsOptions<true>
        ? MaybeDefaultExportMatched<FilterResult<F>>
        : FilterResult<F>,
    id: Metro.ModuleID,
]

export type LookupModuleIdsOptions<
    IncludeUninitialized extends boolean = boolean,
    IncludeAll extends If<IncludeUninitialized, false, boolean> = If<
        IncludeUninitialized,
        false,
        boolean
    >,
> = RunFilterOptions &
    (
        | (BaseLookupModulesOptions<IncludeUninitialized> & {
              includeAll?: false
          })
        | ({
              /**
               * Whether to include all modules, including ones with bad exports.
               * This option overrides `includeInitialized` and `includeUninitialized`.
               *
               * This will filter modules in order of how they're defined.
               *
               * @default false
               */
              includeAll: IncludeAll
          } & BaseLookupModulesOptions<false>)
    )

/**
 * Lookup modules.
 *
 * You can lookup uninitialized modules by passing `options.includeUninitialized` when filtering via without-exports filters (eg. `byDependencies`).
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
    F extends O extends BaseLookupModulesOptions<true>
        ? Filter<any, false>
        : Filter,
    O extends LookupModulesOptions,
>(filter: F, options: O): Generator<LookupModulesResult<F, O>, undefined>

export function* lookupModules(filter: Filter, options?: LookupModulesOptions) {
    if (options?.includeInitialized ?? true)
        for (const id of _inits) {
            const exports = getInitializedModuleExports(id)
            const flag = runFilter(filter, id, exports, options)
            if (flag)
                yield [exportsFromFilterResultFlag(flag, exports, options), id]
        }

    if (options?.includeUninitialized)
        for (const id of _uninits)
            if (runFilter(filter, id)) {
                // Run the filter again to ensure we have the correct exports
                const exports = __r(id)
                const flag = runFilter(filter, id, exports, options)
                if (flag)
                    yield [
                        exportsFromFilterResultFlag(flag, exports, options),
                        id,
                    ]
                else warnDeveloperAboutAPartialFilterMatch(id, filter.key)
            }
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
): LookupModulesResult<F, object> | []

export function lookupModule<F extends Filter, O extends LookupModulesOptions>(
    filter: F,
    options: O,
): LookupModulesResult<F, O> | []

export function lookupModule(filter: Filter, options?: LookupModulesOptions) {
    if (options?.includeInitialized ?? true)
        for (const id of _inits) {
            const exports = getInitializedModuleExports(id)
            const flag = runFilter(filter, id, exports, options)
            if (flag)
                return [exportsFromFilterResultFlag(flag, exports, options), id]
        }

    if (options?.includeUninitialized)
        for (const id of _uninits)
            if (runFilter(filter, id)) {
                const exports = __r(id)
                // Run the filter again to ensure we have the correct exports
                const flag = runFilter(filter, id, exports, options)
                if (flag)
                    return [
                        exportsFromFilterResultFlag(flag, exports, options),
                        id,
                    ]
                warnDeveloperAboutAPartialFilterMatch(id, filter.key)
            }

    return []
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
    const id = _paths.get(path)
    if (id == null) return []
    return [getInitializedModuleExports(id), id]
}

/**
 * Warns the developer that the filter matched during exportsless comparison, but not during the full comparison.
 * This will cause modules to be initialized unnecessarily, and may cause issues.
 * @internal
 */
function warnDeveloperAboutAPartialFilterMatch(
    id: Metro.ModuleID,
    key: string,
) {
    console.warn(
        `[revenge.modules.finders.lookup] Module ${id} matched ${key} during uninitialized lookup, but did not match the full filter.`,
    )
}
