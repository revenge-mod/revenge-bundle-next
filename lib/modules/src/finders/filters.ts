import { mInitialized } from '../metro/patches'
import { getModuleDependencies, isModuleInitialized } from '../metro/utils'
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

// @ts-expect-error: This works perfectly fine!
export interface FilterGenerator<G extends (...args: any[]) => Filter>
    extends G {
    keyFor: (args: Parameters<G>) => string
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
): FilterGenerator<(...args: A) => Filter<any, true>>

export function createFilterGenerator<A extends any[]>(
    filter: (args: A, id: Metro.ModuleID) => boolean,
    keyFor: (args: A) => string,
): FilterGenerator<(...args: A) => Filter<any, false>>

export function createFilterGenerator<A extends any[]>(
    f: (args: A, id: Metro.ModuleID, exports?: Metro.ModuleExports) => boolean,
    keyFor: (args: A) => string,
): FilterGenerator<(...args: A) => Filter> {
    const generator = (...args: A) => {
        const filter = (id: Metro.ModuleID, exports?: Metro.ModuleExports) =>
            f(args, id, exports)
        filter.key = keyFor(args)
        return filter
    }
    generator.keyFor = keyFor
    return generator
}

export type ByProps = FilterGenerator<
    <T extends Record<string, any> = Record<string, any>>(
        prop: keyof T,
        ...props: Array<keyof T>
    ) => Filter<T, true>
>

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
        const type = typeof exports
        if (type === 'object' || type === 'function') {
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

export type WithoutProps = FilterGenerator<
    <T extends Record<string, any>>(
        prop: string,
        ...props: string[]
    ) => Filter<T, true>
>

/**
 * Filter modules by their exports having none of the specified properties.
 *
 * @param prop The property to check for.
 * @param props More properties to check for (optional).
 */
export const withoutProps = createFilterGenerator<Parameters<WithoutProps>>(
    (props, _, exports) => {
        const type = typeof exports
        if (type === 'object' || type === 'function')
            for (const prop of props) if (prop in exports) return false

        return true
    },
    props => `revenge.withoutProps(${props.join(',')})`,
) as WithoutProps

export type BySingleProp = FilterGenerator<
    <T extends Record<string, any>>(prop: keyof T) => Filter<T, true>
>

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
    ([prop], _, exports) => {
        if (typeof exports === 'object' && prop in exports) {
            let hasMultipleProperties = false
            for (const _ in exports) {
                if (hasMultipleProperties) return false
                hasMultipleProperties = true
            }

            return true
        }

        return false
    },
    ([prop]) => `revenge.singleProp(${prop})`,
) as BySingleProp

export type ByName = FilterGenerator<
    <T extends object = object>(name: string) => Filter<T, true>
>

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

export interface ComparableDependencyMap
    extends Array<
        Metro.ModuleID | number | undefined | ComparableDependencyMap
    > {
    l?: boolean
    r?: number
}

type ByDependencies = FilterGenerator<
    <T>(deps: ComparableDependencyMap) => Filter<T, false>
> & {
    loose: typeof loose
    relative: typeof relative
}

/**
 * Filter modules by their dependency map.
 *
 * @param deps The dependency map to check for, can be a sparse array or have `undefined` to be any dependency ("dynamic"). **Order and size matters!**
 *
 * To do proper fingerprinting for modules:
 * @see {@link byDependencies.loose} to loosen the checks.
 * @see {@link byDependencies.relative} to compare dependencies relatively.
 *
 * @example
 * ```ts
 * const { loose, relative } = byDependencies
 *
 * // Logger's module ID is 5
 * // It has 3 dependencies [4, ?, 2]
 *
 * const [Logger] = lookupModule(byDependencies([4, undefined, 2]))
 * // or
 * const [Logger] = lookupModule(byDependencies([4, , 2]))
 *
 * // Relative dependencies
 * const [Logger] = lookupModule(byDependencies([relative(-1), undefined, 2]))
 *
 * // Nested dependencies
 * // The last dependency (module ID 2) would need to have zero dependencies:
 * const [Logger] = lookupModule(byDependencies([4, undefined, []]))
 *
 * // Loose dependencies
 * // Module having these dependencies: [4, ...], [4, ..., ...], [4, ..., ..., ...], etc. would match:
 * const [SomeOtherModule] = lookupModule(byDependencies(loose([4])))
 * ```
 */
export const byDependencies = createFilterGenerator<Parameters<ByDependencies>>(
    ([deps], id) => depCompare(getModuleDependencies(id)!, deps, id, id),
    deps => `revenge.deps(${depGenFilterKey(deps)})`,
) as ByDependencies

byDependencies.loose = loose
byDependencies.relative = relative

/**
 * Make this set of comparable dependencies as loose.
 *
 * Making a dependency loose skips the exact length check, but the order of the set dependencies still matters.
 * If you mark an index as dynamic, the same index must also be present in the other map during comparison to pass.
 *
 * @param deps The dependency map to make loose. This permanently modifies the array.
 * @returns The modified dependency map.
 */
function loose(deps: ComparableDependencyMap) {
    deps.l = true
    return deps
}

const RelativeSignBit = 1 << 30
const RelativeBit = 1 << 29
const RelativeRootBit = 1 << 28
const RelativeBitMask = ~(RelativeSignBit | RelativeBit | RelativeRootBit)

/**
 * Marks this dependency to compare relatively to the module ID being compared.
 *
 * @param id The dependency ID to mark as relative.
 * @param root Marks this dependency to compare relatively to the root (returning) module ID being compared. Useful for nested comparisons where you want to compare by the root module ID instead of the parent's module ID of the nested dependency.
 */
function relative(id: Metro.ModuleID, root?: boolean) {
    id = (id < 0 ? -id | RelativeSignBit : id) | RelativeBit
    if (root) id |= RelativeRootBit
    return id
}

/**
 * Marks this dependency to compare relatively to the module ID being compared, with an additional dependencies check.
 *
 * @param deps The dependency map to add the relative dependency to. This permanently modifies the array.
 * @param id The dependency ID to mark as relative.
 * @param root Whether to use {@link relative.toRoot} instead of {@link relative}. Defaults to `false`.
 * @returns The modified dependency map.
 *
 * @see {@link byDependencies}
 * @see {@link relative}
 * @see {@link relative.toRoot}
 *
 * @example
 * ```ts
 * const { relative } = byDependencies
 *
 * // This filter will match modules having one dependency that is its module ID + 1
 * // And module ID + 1 would have exactly two dependencies: [Any, 2]
 * byDependencies(
 *   relative.withDependencies(
 *     [undefined, 2],
 *     1, // Always the next module to the one being compared
 *     true, // The module ID being compared matches the returning (root) module ID
 *   )
 * )
 * ```
 */
relative.withDependencies = (
    deps: ComparableDependencyMap,
    id: Metro.ModuleID,
    root?: boolean,
) => {
    deps.r = relative(id, root)
    return deps
}

function depCompare(
    a: Metro.ModuleID[],
    b: ComparableDependencyMap,
    root: Metro.ModuleID,
    parent: Metro.ModuleID,
): boolean {
    if (b.l ? a.length < b.length : a.length !== b.length) return false

    for (let i = 0; i < b.length; i++) {
        const compare = b[i]
        // Skip dynamic
        if (compare === undefined) continue

        const id = a[i]

        if (Array.isArray(compare)) {
            // relative.withDependencies?
            if (compare.r && !depShallowCompare(compare.r, id, root, parent))
                return false

            if (depCompare(getModuleDependencies(id)!, compare, root, id))
                continue
        } else if (depShallowCompare(compare, id, root, parent)) continue

        return false
    }

    return true
}

function depShallowCompare(
    compare: number,
    id: Metro.ModuleID,
    root: Metro.ModuleID,
    parent: Metro.ModuleID,
) {
    // relative?
    if (compare & RelativeBit)
        compare =
            (compare & RelativeRootBit ? root : parent) +
            depGetRelMagnitude(compare)

    return compare === id
}

function depGetRelMagnitude(dep: number) {
    const rootRelative = dep & RelativeSignBit
    dep = dep & RelativeBitMask
    if (rootRelative) dep = -dep
    return dep
}

function depGenFilterKey(deps: ComparableDependencyMap): string {
    let key = ''

    for (let i = 0; i < deps.length; i++) {
        const dep = deps[i]

        if (dep === undefined) key += ','
        else if (Array.isArray(dep)) {
            if (dep.l) key += '#'
            key += `[${depGenFilterKey(dep)}],`
        } else {
            if (dep & RelativeBit) {
                const magnitude = depGetRelMagnitude(dep)
                const prefix = dep & RelativeRootBit ? '~' : '^'
                key += `${prefix}${magnitude},`
            } else key += `${dep},`
        }
    }

    return key.substring(0, key.length - 1)
}

export type Every = FilterGenerator<{
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
}>

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

export type Some = FilterGenerator<{
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
}>

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

export type ModuleStateAware = FilterGenerator<
    <IF extends Filter>(
        initializedFilter: IF,
        uninitializedFilter: Filter<any, false>,
        strict?: boolean,
    ) => Filter<FilterResult<IF>, false>
>

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
            if (mInitialized.has(id) && initializedFilter(id, exports))
                return strict ? uninitializedFilter(id) : true
            return false
        }

        return uninitializedFilter(id)
    },
    ([f1, f2]) => `revenge.moduleStateAware(${f1.key},${f2.key})`,
) as ModuleStateAware

export type PreferExports = FilterGenerator<
    <WEF extends Filter>(
        withExportsFilter: WEF,
        exportslessFilter: Filter<any, false>,
        strict?: boolean,
    ) => Filter<FilterResult<WEF>, false>
>

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
        if (mInitialized.has(id)) {
            if (withExportsFilter(id, exports))
                return strict ? exportslessFilter(id) : true
            return false
        }

        return exportslessFilter(id)
    },
    ([f1, f2]) => `revenge.preferExports(${f1.key},${f2.key})`,
) as PreferExports
