import { _inits } from '../metro/_internal'
import {
    getModuleDependencies,
    initializedModuleHasBadExports,
    isModuleInitialized,
} from '../metro/utils'
import type { If, LogicalOr } from '@revenge-mod/utils/types'
import type { Metro } from '../types'

export type FilterResult<F> = F extends Filter<infer R, boolean> ? R : never

export type IsFilterWithExports<F> = F extends Filter<any, infer WE>
    ? WE
    : never

export interface Filter<
    _Inferable = any,
    WithExports extends boolean = boolean,
> {
    (
        ...args: If<
            WithExports,
            [id: Metro.ModuleID, exports: Metro.ModuleExports],
            [id: Metro.ModuleID, exports?: never]
        >
    ): boolean
    key: string
}

/**
 * Create a filter generator.
 *
 * @param filter The function that filters the modules.
 * @param keyFor The function that generates the key for the filter.
 * @returns A function that generates a filter with the specified arguments.
 *
 * @example
 * ```ts
 * const custom = createFilterGenerator<[arg1: number, arg2: string]>(
 *   ([arg1, arg2], id, exports) => {
 *     // filter logic
 *     return true
 *   },
 *   ([arg1, arg2]) => `revenge.custom(${arg1}, ${arg2})`
 * )
 * ```
 *
 * @see {@link byProps} for an example on custom-typed filters.
 */
export function createFilterGenerator<A extends any[]>(
    filter: (
        args: A,
        id: Metro.ModuleID,
        exports: Metro.ModuleExports,
    ) => boolean,
    keyFor: (args: A) => string,
): (...args: A) => Filter<object, true>

export function createFilterGenerator<A extends any[]>(
    filter: (args: A, id: Metro.ModuleID) => boolean,
    keyFor: (args: A) => string,
): (...args: A) => Filter<object, false>

export function createFilterGenerator<A extends any[]>(
    f: (args: A, id: Metro.ModuleID, exports?: Metro.ModuleExports) => boolean,
    keyFor: (args: A) => string,
): (...args: any[]) => Filter {
    return (...args: A) => {
        const filter = (id: Metro.ModuleID, exports?: Metro.ModuleExports) =>
            f(args, id, exports)
        filter.key = keyFor(args)
        return filter
    }
}

export type ByProps = <T extends Record<string, any> = Record<string, any>>(
    prop: keyof T,
    ...props: Array<keyof T>
) => Filter<T, true>

/**
 * Filter modules by their exports having all of the specified properties.
 *
 * @param prop The property to check for.
 * @param props More properties to check for (optional).
 *
 * @example
 * ```ts
 * const [React] = lookupModule(byProps<typeof import('react')>('createElement'))
 * // const React: typeof import('react')
 * ```
 */
export const byProps = createFilterGenerator<Parameters<ByProps>>(
    (props, _, exports) => {
        if (typeof exports === 'object' || typeof exports === 'function') {
            for (const prop of props) {
                if (prop in exports) continue
                return false
            }

            return true
        }

        return false
    },
    props => `revenge.props(${props.join(',')})`,
) as ByProps

export type WithoutProps = <T extends Record<string, any>>(
    prop: string,
    ...props: string[]
) => Filter<T, true>

/**
 * Filter modules by their exports having none of the specified properties.
 *
 * @param prop The property to check for.
 * @param props More properties to check for (optional).
 */
export const withoutProps = createFilterGenerator<Parameters<WithoutProps>>(
    (props, _, exports) => {
        if (typeof exports === 'object' || typeof exports === 'function')
            for (const prop of props) if (prop in exports) return false

        return true
    },
    props => `revenge.withoutProps(${props.join(',')})`,
) as WithoutProps

export type BySingleProp = <T extends Record<string, any>>(
    prop: keyof T,
) => Filter<T, true>

/**
 * Filter modules by their exports having only the specified property.
 *
 * @param prop The property to check for.
 *
 * @example
 * ```ts
 * const [FormSwitchModule] = lookupModule(bySingleProp('FormSwitch'))
 * // const FormSwitchModule: { FormSwitch: any }
 * ```
 */
export const bySingleProp = createFilterGenerator<Parameters<BySingleProp>>(
    // We don't use Reflect.ownKeys here because __esModule is not enumerable, and we don't want to include it in the check
    ([prop], _, exports) =>
        typeof exports === 'object' &&
        Object.keys(exports).length === 1 &&
        prop in exports,
    ([prop]) => `revenge.singleProp(${prop})`,
) as BySingleProp

export type ByName = <T extends object = object>(
    name: string,
) => Filter<T, true>

/**
 * Filter modules by their exports having the specified name.
 *
 * Usually used for function components or classes.
 *
 * @param name The name to check for.
 *
 * @example Auto-typing as object
 * ```ts
 * const [SomeComponent] = lookupModule(byName('SomeComponent'))
 * // const SomeComponent: { name: 'SomeComponent' }
 * ```
 *
 * @example Typing as function component
 * ```ts
 * type MyComponent = React.FC<{ foo: string }>
 *
 * const [MyComponent] = lookupModule(byName<MyComponent>('MyComponent'))
 * // const MyComponent: MyComponent & { name: 'MyComponent' }
 * ```
 *
 * @example Typing as class
 * ```
 * interface SomeClass {
 *    someMethod(): void
 * }
 *
 * const [SomeClass] = lookupModule(byName<{ new(param: string): SomeClass }>('SomeClass'))
 * // const SomeClass: { new(): SomeClass, name: 'SomeClass' }
 */
export const byName = createFilterGenerator<Parameters<ByName>>(
    ([name], _, exports) => exports.name === name,
    ([name]) => `revenge.name(${name})`,
) as ByName

export interface RelativeDependency {
    valueOf(): Metro.ModuleID
    r?: boolean
}

export interface ComparableDependencyMap
    extends Array<
        | Metro.ModuleID
        | RelativeDependency
        | undefined
        | ComparableDependencyMap
    > {
    l?: boolean
}

type ComputedComparableDependencyMap = Exclude<
    ComparableDependencyMap,
    Array<RelativeDependency>
>

type ByDependencies = <T>(deps: ComparableDependencyMap) => Filter<T, false>

/**
 * Filter modules by their dependency map.
 *
 * @param deps The dependency map to check for, can be a sparse array or have `undefined` to be any dependency ("dynamic"). **Order and size matters!**
 * @see {@link looseDeps} to make comparisons less strict.
 *
 * @example
 * ```ts
 * const [Logger] = lookupModule(byDependencies([4, undefined, 2]))
 * // or
 * const [Logger] = lookupModule(byDependencies([4, , 2]))
 * // or with relative dependencies
 * // If Logger's module ID is 20, [19, ..., ..., 2] would match:
 * const [Logger] = lookupModule(byDependencies([relativeDep(-1), , 2]))
 * // or with nested dependencies
 * // The last dependency would need to have zero dependencies:
 * const [Logger] = lookupModule(byDependencies([4, , []]))
 * // or with loose dependencies
 * // Module having 4 dependencies [4, ...], [4, ..., ...], [4, ..., ..., ...] etc. would match:
 * const [SomeOtherModule] = lookupModule(byDependencies(looseDeps([4, ,])))
 * ```
 */
export const byDependencies = createFilterGenerator<Parameters<ByDependencies>>(
    ([deps], id) => compareDeps(id, deps, deps.l),
    deps => `revenge.deps(${genDepsKey(deps)})`,
) as ByDependencies

/**
 * Make this set of comparable dependencies as loose, to be used with {@link byDependencies}.
 *
 * Making a dependency loose skips the exact length check, but the order of the set dependencies still matters.
 * If you mark an index as dynamic, the same index must also be present in the other map during comparison to pass.
 *
 * @param deps The dependency map to make loose. This permanently modifies the array.
 * @returns The modified dependency map.
 */
export function looseDeps(deps: ComparableDependencyMap) {
    deps.l = true
    return deps
}

/**
 * Marks this dependency to compare relatively to the module ID being compared.
 *
 * @param id The dependency ID to mark as relative.
 * @param root Whether this dependency should be relatively to the root module ID. Useless for single-depth comparisons.
 */
export function relativeDep(
    id: Metro.ModuleID,
    root?: boolean,
): RelativeDependency {
    const o = Object(id) as RelativeDependency
    if (root) o.r = true
    return o
}

function compareDeps(
    rootOf: Metro.ModuleID,
    compare: ComparableDependencyMap,
    loose = false,
): boolean {
    const stack: Array<
        [
            of: Metro.ModuleID,
            deps: Metro.ModuleID[],
            compare: ComparableDependencyMap,
            loose?: boolean,
        ]
    > = []

    stack.push([rootOf, getModuleDependencies(rootOf)!, compare, loose])

    while (stack.length) {
        const [of, deps, compare, loose] = stack.pop()!
        if (
            loose
                ? deps.length < compare.length
                : deps.length !== compare.length
        )
            return false

        const ccmp: ComputedComparableDependencyMap = []
        for (let i = 0; i < compare.length; i++) {
            const cmp = compare[i]
            if (cmp === undefined) continue

            if (Array.isArray(cmp)) ccmp[i] = cmp
            else if (typeof cmp === 'object')
                ccmp[i] = cmp.r ? rootOf + cmp.valueOf() : of + cmp.valueOf()
            else ccmp[i] = cmp
        }

        for (let i = 0; i < ccmp.length; i++) {
            const orig = deps[i]
            const cmp = ccmp[i]
            if (cmp === undefined) continue

            if (Array.isArray(cmp)) {
                const dependencies = getModuleDependencies(orig)
                if (!dependencies) return false
                stack.push([orig, dependencies, cmp, cmp.l])
            } else if (cmp !== orig) return false
        }
    }

    return true
}

function genDepsKey(deps: ComparableDependencyMap): string {
    let key = ''

    for (const dep of deps)
        if (dep === undefined) key += ','
        else if (Array.isArray(dep)) {
            if (dep.l) key += '#'
            key += `[${genDepsKey(dep)}],`
        } else
            key += `${(dep as RelativeDependency).r ? `r${dep.valueOf()}` : dep.valueOf()},`

    return key.substring(0, key.length - 1)
}

export type Every = {
    <F1 extends Filter, F2 extends Filter>(
        f1: F1,
        f2: F2,
    ): Filter<
        FilterResult<F1> & FilterResult<F2>,
        LogicalOr<IsFilterWithExports<F1>, IsFilterWithExports<F2>>
    >
    <F1 extends Filter, F2 extends Filter, F3 extends Filter>(
        f1: F1,
        f2: F2,
        f3: F3,
    ): Filter<
        FilterResult<F1> & FilterResult<F2> & FilterResult<F3>,
        LogicalOr<
            LogicalOr<IsFilterWithExports<F1>, IsFilterWithExports<F2>>,
            IsFilterWithExports<F3>
        >
    >
    (...filters: Filter[]): Filter
}

/**
 * Combines multiple filters into one, returning true if **every** filter matches.
 *
 * @param filters The filters to combine.
 *
 * @example
 * ```ts
 * const [SomeModule] = lookupModule(every(
 *    byProps('x', 'name'),
 *    byName('SomeName'),
 *    byDependencies([1, 485, undefined, 2]),
 * ))
 * ```
 */
export const every = createFilterGenerator<[...filters: Filter[]]>(
    (filters, id, exports) => {
        for (const filter of filters) {
            if (filter(id, exports)) continue
            return false
        }

        return true
    },
    filters => `revenge.every(${filtersToKey(filters)})`,
) as Every

export type Some = {
    <F1 extends Filter, F2 extends Filter>(
        f1: F1,
        f2: F2,
    ): Filter<
        FilterResult<F1> | FilterResult<F2>,
        IsFilterWithExports<F1> | IsFilterWithExports<F2>
    >
    <F1 extends Filter, F2 extends Filter, F3 extends Filter>(
        f1: F1,
        f2: F2,
        f3: F3,
    ): Filter<
        FilterResult<F1> | FilterResult<F2> | FilterResult<F3>,
        | IsFilterWithExports<F1>
        | IsFilterWithExports<F2>
        | IsFilterWithExports<F3>
    >
    (...filters: Filter[]): Filter
}

/**
 * Combines multiple filters into one, returning true if **some** filters match.
 *
 * @param filters The filters to combine.
 *
 * @example
 * ```ts
 * const [SomeModule] = lookupModule(some(
 *   byProps('x', 'name'),
 *   byName('SomeName'),
 *   byDependencies([1, 485, undefined, 2]),
 * ))
 * ```
 */
export const some = createFilterGenerator<[...filters: Filter[]]>(
    (filters, id, exports) => {
        for (const filter of filters) if (filter(id, exports)) return true
        return false
    },
    filters => `revenge.some(${filtersToKey(filters)})`,
) as Some

function filtersToKey(filters: Filter[]): string {
    let s = ''
    for (const filter of filters) s += `${filter.key},`
    return s.substring(0, s.length - 1)
}

export type ModuleStateAware = <IF extends Filter>(
    initializedFilter: IF,
    uninitializedFilter: Filter<any, false>,
    strict?: boolean,
) => Filter<FilterResult<IF>, false>

/**
 * Filter modules depending on their initialized state. **Initialized modules with bad exports are skipped.**
 *
 * @param initializedFilter The filter to use for initialized modules.
 * @param uninitializedFilter The filter to use for uninitialized modules.
 * @param strict Whether to also filter with `uninitializedFilter` after `initializedFilter` passes, confirming the module is definitely the correct module. Defaults to `false`.
 *
 * @example
 * ```ts
 * // will filter byProps('x') for initialized modules
 * // and byDependencies([1, 485, undefined, 2]) for uninitialized modules
 * const [SomeModule] = lookupModule(moduleStateAware(
 *   byProps('x'),
 *   byDependencies([1, 485, undefined, 2]),
 * ))
 * ```
 */
export const moduleStateAware = createFilterGenerator<
    Parameters<ModuleStateAware>
>(
    ([initializedFilter, uninitializedFilter, strict], id, exports) => {
        if (isModuleInitialized(id)) {
            if (initializedModuleHasBadExports(id)) return false
            if (initializedFilter(id, exports))
                return strict ? uninitializedFilter(id) : true
            return false
        }

        return uninitializedFilter(id)
    },
    ([f1, f2]) => `revenge.moduleStateAware(${f1.key},${f2.key})`,
) as ModuleStateAware

export type PreferExports = <WEF extends Filter>(
    withExportsFilter: WEF,
    exportslessFilter: Filter<any, false>,
    strict?: boolean,
) => Filter<FilterResult<WEF>, false>

/**
 * Filter modules depending on if their exports are available and filterable.
 *
 * @see {@link isModuleExportsBad} for more information on what is considered bad module exports.
 *
 * @see {@link moduleStateAware} for an alternative that filters based on the module's initialized state.
 *
 * @param withExportsFilter The filter to use for modules with proper exports.
 * @param exportslessFilter The filter to use for modules without proper exports (uninitialized or bad).
 * @param strict Whether to also filter with `exportslessFilter` after `withExportsFilter` passes, confirming the module is definitely the correct module. Defaults to `false`.
 *
 * @example
 * ```ts
 * // will filter byProps('x') for modules with proper exports
 * // and byDependencies([1, 485, undefined, 2]) for without proper exports (uninitialized or bad)
 * const [SomeModule] = lookupModule(preferExports(
 *   byProps('x'),
 *   byDependencies([1, 485, undefined, 2]),
 * ))
 * ```
 */
export const preferExports = createFilterGenerator<Parameters<PreferExports>>(
    ([withExportsFilter, exportslessFilter, strict], id, exports) => {
        if (_inits.has(id)) {
            if (withExportsFilter(id, exports))
                return strict ? exportslessFilter(id) : true
            return false
        }

        return exportslessFilter(id)
    },
    ([f1, f2]) => `revenge.preferExports(${f1.key},${f2.key})`,
) as PreferExports
