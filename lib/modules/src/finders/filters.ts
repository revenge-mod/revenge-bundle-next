import { getCurrentStack } from '@revenge-mod/utils/error'
import { mInitialized } from '../metro/patches'
import { getModuleDependencies, isModuleInitialized } from '../metro/utils'
import type { If, LogicalOr } from '@revenge-mod/utils/types'
import type { Metro } from '../types'

export type FilterResult<F> = F extends Filter<infer R, boolean>
    ? R
    : F extends FilterBase<infer R>
      ? R
      : never

export type IsFilterWithExports<F> = F extends Filter<any, infer WE>
    ? WE
    : F extends FilterBase<any, infer WE>
      ? WE
      : never

interface FilterBase<_Inferable = any, WithExports extends boolean = boolean> {
    (
        ...args: If<
            WithExports,
            [id: Metro.ModuleID, exports: Metro.ModuleExports],
            [id: Metro.ModuleID, exports?: never]
        >
    ): boolean
    key: string
}
export type Filter<
    Inferable = any,
    WithExports extends boolean = boolean,
> = FilterHelpers & FilterBase<Inferable, WithExports>

interface FilterHelpers {
    /**
     * Manually the key for this filter.
     *
     * **Don't use this unless you know what you're doing.** Only API exports should be using
     *
     * @param key The key to set for this filter.
     */
    keyAs<T extends FilterBase>(this: T, key: string): T
    /**
     * Combines this filter with another filter, returning a new filter that matches if **both** filters match.
     *
     * @param filter The filter to combine with.
     */
    and<T extends FilterBase, F extends FilterBase>(
        this: T,
        filter: F,
    ): Filter<
        FilterResult<T> & FilterResult<F>,
        LogicalOr<IsFilterWithExports<T>, IsFilterWithExports<F>>
    >
    /**
     * Combines this filter with another filter, returning a new filter that matches if **either** filter matches.
     *
     * @param filter
     */
    or<T extends FilterBase, F extends FilterBase>(
        this: T,
        filter: F,
    ): Filter<
        FilterResult<T> | FilterResult<F>,
        IsFilterWithExports<T> | IsFilterWithExports<F>
    >
    /**
     * Combines this filter with another filter that filters by exports, returning a new filter that matches if **both** filters match.
     *
     * @see {@link preferExports} for more information on how to use this.
     */
    withExports<T extends FilterBase<any, false>>(
        this: T,
        withExportsFilter: FilterBase<any, true>,
        strict?: boolean,
    ): Filter<
        FilterResult<typeof withExportsFilter>,
        IsFilterWithExports<T> | IsFilterWithExports<typeof withExportsFilter>
    >
    /**
     * Combines this filter with another filter that filters by dependencies, returning a new filter that matches if **both** filters match.
     *
     * @see {@link byDependencies} for more information on how to use this.
     */
    withDependencies<T extends FilterBase<any, true>>(
        this: T,
        deps: ComparableDependencyMap,
        strict?: boolean,
    ): Filter<FilterResult<T>, false>
}

export type FilterGenerator<G extends (...args: any[]) => Filter> = G & {
    keyFor(args: Parameters<G>): string
}

const Helpers: FilterHelpers = Object.setPrototypeOf(
    {
        keyAs(key) {
            this.key = key
            return this
        },
        and(filter) {
            return every(this, filter)
        },
        or(filter) {
            return some(this, filter)
        },
        withExports(withExportsFilter, strict) {
            return preferExports(withExportsFilter, this, strict)
        },
        withDependencies(deps, strict) {
            return preferExports(this, byDependencies(deps), strict)
        },
    } satisfies FilterHelpers,
    Function.prototype,
)

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
 *   ([arg1, arg2]) => `custom(${arg1}, ${arg2})`
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
    filter: (
        args: A,
        id: Metro.ModuleID,
        exports?: Metro.ModuleExports,
    ) => boolean,
    keyFor: (args: A) => string,
): FilterGenerator<(...args: A) => Filter> {
    type GeneratorType = ReturnType<typeof createFilterGenerator<A>>

    const generator: GeneratorType = (...args: A) => {
        const filter_ = ((id: Metro.ModuleID, exports?: Metro.ModuleExports) =>
            filter(args, id, exports)) as ReturnType<GeneratorType>

        filter_.key = keyFor(args)
        return Object.setPrototypeOf(filter_, Helpers)
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
        if (typeof exports === 'object' && prop in exports)
            return Object.keys(exports).length === 1

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
        Metro.ModuleID | number | null | undefined | ComparableDependencyMap
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

const __DEBUG_WARNED_BAD_BY_DEPENDENCIES_FILTERS__ =
    new Set<ComparableDependencyMap>()

/**
 * Filter modules by their dependency map.
 *
 * @param deps The dependency map to check for, can be a sparse array or have `null` to be any dependency ("dynamic"). **Order and size matters!**
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
 * const [Logger] = lookupModule(byDependencies([4, null, 2]))
 * // or
 * const [Logger] = lookupModule(byDependencies([4, , 2]))
 *
 * // Relative dependencies
 * const [Logger] = lookupModule(byDependencies([relative(-1), null, 2]))
 *
 * // Nested dependencies
 * // The last dependency (module ID 2) would need to have zero dependencies:
 * const [Logger] = lookupModule(byDependencies([4, null, []]))
 *
 * // Loose dependencies
 * // Module having these dependencies: [4, ...], [4, ..., ...], [4, ..., ..., ...], etc. would match:
 * const [SomeOtherModule] = lookupModule(byDependencies(loose([4])))
 * ```
 *
 * @example With filter helpers (preferred)
 * ```ts
 * const [Logger] = lookupModule(
 *   byProps('log')
 *     .withDependencies([4, null, 2]),
 * )
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
 *
 * @example
 * ```ts
 * const { relative } = byDependencies
 *
 * // This filter will match modules having one dependency that is its module ID + 1
 * // And module ID + 1 would have exactly two dependencies: [Any, 2]
 * byDependencies(
 *   relative.withDependencies(
 *     [null, 2],
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

/**
 * Warns the developer about a bad `byDependencies` filter using `undefined` in its comparisons.
 *
 * - `undefined` should only be used as a fallback to when a module ID can really not be found.
 * - Use `null` instead to indicate a dynamic dependency.
 */
function DEBUG_warnBadByDependenciesFilter(
    deps: ComparableDependencyMap,
    index: number,
) {
    // already warned
    if (__DEBUG_WARNED_BAD_BY_DEPENDENCIES_FILTERS__.has(deps)) return

    nativeLoggingHook(
        `\u001b[33mBad ${byDependencies.name} filter, undefined ID at index ${index} (if intentional, set to null): [${depGenFilterKey(deps)}]\n${getCurrentStack()}\u001b[0m`,
        2,
    )
}

function depCompare(
    a: Metro.ModuleID[],
    b: ComparableDependencyMap,
    root: Metro.ModuleID,
    parent: Metro.ModuleID,
): boolean {
    const lenA = a.length
    const lenB = b.length
    if (b.l ? lenA < lenB : lenA !== lenB) return false

    for (let i = 0; i < lenB; i++) {
        const compare = b[i]

        if (__DEV__ && compare === undefined)
            DEBUG_warnBadByDependenciesFilter(b, i)

        // Skip dynamic
        if (compare == null) continue

        const id = a[i]

        // Check if it's an array (typeof is faster than Array.isArray)
        if (typeof compare === 'object') {
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

        if (dep == null) key += ','
        else if (typeof dep === 'object') {
            if (dep.l) key += '#'
            // relative.withDependencies?
            if (dep.r) key += depGenRelativeKeyPart(dep.r)

            key += `[${depGenFilterKey(dep)}],`
        } else {
            if (dep & RelativeBit) key += depGenRelativeKeyPart(dep)
            else key += `${dep},`
        }
    }

    return key.substring(0, key.length - 1)
}

function depGenRelativeKeyPart(dep: number) {
    const magnitude = depGetRelMagnitude(dep)
    const prefix = dep & RelativeRootBit ? '~' : '^'
    return `${prefix}${magnitude},`
}

export type Every = FilterGenerator<{
    <F1 extends FilterBase, F2 extends FilterBase>(
        f1: F1,
        f2: F2,
    ): Filter<
        FilterResult<F1> & FilterResult<F2>,
        LogicalOr<IsFilterWithExports<F1>, IsFilterWithExports<F2>>
    >
    <F1 extends FilterBase, F2 extends FilterBase, F3 extends FilterBase>(
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
    (...filters: FilterBase[]): Filter
}>

/**
 * Combines multiple filters into one, returning true if **every** filter matches.
 *
 * @param filters The filters to combine.
 *
 * @example With filter helpers (preferred)
 * ```ts
 * const [SomeModule] = lookupModule(
 *   byProps('x', 'name')
 *     .and(byName('SomeName'))
 *     .and(byDependencies([1, 485, null, 2])),
 * )
 * ```
 *
 * @example
 * ```ts
 * const [SomeModule] = lookupModule(every(
 *    byProps('x', 'name'),
 *    byName('SomeName'),
 *    byDependencies([1, 485, null, 2]),
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
    <F1 extends FilterBase, F2 extends FilterBase>(
        f1: F1,
        f2: F2,
    ): Filter<
        FilterResult<F1> | FilterResult<F2>,
        IsFilterWithExports<F1> | IsFilterWithExports<F2>
    >
    <F1 extends FilterBase, F2 extends FilterBase, F3 extends FilterBase>(
        f1: F1,
        f2: F2,
        f3: F3,
    ): Filter<
        FilterResult<F1> | FilterResult<F2> | FilterResult<F3>,
        | IsFilterWithExports<F1>
        | IsFilterWithExports<F2>
        | IsFilterWithExports<F3>
    >
    (...filters: FilterBase[]): Filter
}>

/**
 * Combines multiple filters into one, returning true if **some** filters match.
 *
 * @param filters The filters to combine.
 *
 * @example With filter helpers (preferred)
 * ```ts
 * const [SomeModule] = lookupModule(
 *   byProps('x', 'name')
 *     .or(byName('SomeName'))
 *     .or(byDependencies([1, 485, null, 2])),
 * )
 * ```
 *
 * @example
 * ```ts
 * const [SomeModule] = lookupModule(some(
 *   byProps('x', 'name'),
 *   byName('SomeName'),
 *   byDependencies([1, 485, null, 2]),
 * ))
 * ```
 */
export const some = createFilterGenerator<[...filters: FilterBase[]]>(
    (filters, id, exports) => {
        for (const filter of filters) if (filter(id, exports)) return true
        return false
    },
    filters => `revenge.some(${filtersToKey(filters)})`,
) as Some

function filtersToKey(filters: FilterBase[]): string {
    let s = ''
    for (const filter of filters) s += `${filter.key},`
    return s.substring(0, s.length - 1)
}

export type ModuleStateAware = FilterGenerator<
    <IF extends FilterBase>(
        initializedFilter: IF,
        uninitializedFilter: FilterBase<any, false>,
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
 * // and byDependencies([1, 485, null, 2]) for uninitialized modules
 * const [SomeModule] = lookupModule(moduleStateAware(
 *   byProps('x'),
 *   byDependencies([1, 485, null, 2]),
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
    <WEF extends FilterBase>(
        withExportsFilter: WEF,
        exportslessFilter: FilterBase<any, false>,
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
 * @example With filter helpers (preferred)
 * ```ts
 * const [SomeModule] = lookupModule(
 *   byDependencies([1, 485, null, 2])
 *     .withExports(byProps('x')),
 * )
 * ```
 *
 * @example
 * ```ts
 * // will filter byProps('x') for modules with proper exports
 * // and byDependencies([1, 485, null, 2]) for without proper exports (uninitialized or bad)
 * const [SomeModule] = lookupModule(preferExports(
 *   byProps('x'),
 *   byDependencies([1, 485, null, 2]),
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
