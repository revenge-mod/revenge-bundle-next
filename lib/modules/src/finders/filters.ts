import { getCurrentStack } from '@revenge-mod/utils/error'
import { mInitialized } from '../metro/patches'
import { getModuleDependencies } from '../metro/utils'
import type { If, LogicalOr } from '@revenge-mod/utils/types'
import type { Metro } from '../types'

export const FilterFlags = {
    /**
     * This filter works with and without module exports.
     * Allowing for both initialized and uninitialized modules to be matched.
     */
    Any: 0,
    /**
     * This filter requires module exports to work.
     * Only initialized modules will be matched.
     */
    RequiresExports: 1,
} as const

/**
 * @see {@link FilterFlags}
 */
export type FilterFlags = number

export type FilterResult<F> = F extends Filter<infer R, boolean>
    ? R
    : F extends FilterBase<infer R>
      ? R
      : never

export type IsFilterWithExports<F> = F extends Filter<any, infer RE>
    ? RE
    : F extends FilterBase<any, infer RE>
      ? RE
      : never

export interface FilterBase<
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
    flags: FilterFlags
}

export type Filter<
    Inferable = any,
    WithExports extends boolean = boolean,
> = FilterHelpers & FilterBase<Inferable, WithExports>

export interface FilterHelpers {
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
    and<
        T extends FilterBase,
        // If Filter<any, true>, next filter must also be Filter<any, true>
        // Otherwise, it can be Filter<any, boolean>
        F extends If<IsFilterWithExports<T>, FilterBase<any, true>, FilterBase>,
    >(
        this: T,
        filter: F,
    ): Filter<
        FilterResult<T> & FilterResult<F>,
        LogicalOr<IsFilterWithExports<T>, IsFilterWithExports<F>>
    >
    /**
     * Combines this filter with another filter, returning a new filter that matches if **either** filter matches.
     *
     * Note that exportsless filters must come first to avoid gotchas with uninitialized modules.
     *
     * @param filter The filter to combine with.
     */
    or<
        T extends FilterBase,
        // If Filter<any, true>, next filter must also be Filter<any, true>
        // Otherwise, it can be Filter<any, boolean>
        F extends If<IsFilterWithExports<T>, FilterBase<any, true>, FilterBase>,
    >(
        this: T,
        filter: F,
    ): Filter<
        FilterResult<T> | FilterResult<F>,
        IsFilterWithExports<T> | IsFilterWithExports<F>
    >
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
            return and(this, filter)
        },
        or(filter) {
            return or(this, filter)
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
 * @see {@link withProps} for an example on custom-typed filters.
 */
export function createFilterGenerator<A extends any[]>(
    filter: (
        args: A,
        id: Metro.ModuleID,
        exports: Metro.ModuleExports,
    ) => boolean,
    keyFor: (args: A) => string,
    flagsFor: ((args: A) => FilterFlags) | FilterFlags,
): FilterGenerator<(...args: A) => Filter<any, true>>

export function createFilterGenerator<A extends any[]>(
    filter: (args: A, id: Metro.ModuleID) => boolean,
    keyFor: (args: A) => string,
    flagsFor: ((args: A) => FilterFlags) | FilterFlags,
): FilterGenerator<(...args: A) => Filter<any, false>>

export function createFilterGenerator<A extends any[]>(
    filter: (
        args: A,
        id: Metro.ModuleID,
        exports?: Metro.ModuleExports,
    ) => boolean,
    keyFor: (args: A) => string,
    flagsFor: ((args: A) => FilterFlags) | FilterFlags,
): FilterGenerator<(...args: A) => Filter> {
    type GeneratorType = ReturnType<typeof createFilterGenerator<A>>

    const isFlagsStatic = typeof flagsFor === 'number'

    const generator: GeneratorType = (...args: A) => {
        const filter_ = ((id: Metro.ModuleID, exports?: Metro.ModuleExports) =>
            filter(args, id, exports)) as ReturnType<GeneratorType>

        filter_.key = keyFor(args)
        filter_.flags = isFlagsStatic ? flagsFor : flagsFor(args)
        return Object.setPrototypeOf(filter_, Helpers)
    }

    generator.keyFor = keyFor
    return generator
}

export type WithProps = FilterGenerator<
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
 * const [React] = lookupModule(withProps<typeof import('react')>('createElement'))
 * // const React: typeof import('react')
 * ```
 */
export const withProps = createFilterGenerator<Parameters<WithProps>>(
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
    FilterFlags.RequiresExports,
) as WithProps

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
    FilterFlags.RequiresExports,
) as WithoutProps

export type WithSingleProp = FilterGenerator<
    <T extends Record<string, any>>(prop: keyof T) => Filter<T, true>
>

/**
 * Filter modules by their exports having only the specified property.
 *
 * @param prop The property to check for.
 *
 * @example
 * ```ts
 * const [FormSwitchModule] = lookupModule(withSingleProp('FormSwitch'))
 * // const FormSwitchModule: { FormSwitch: any }
 * ```
 */
export const withSingleProp = createFilterGenerator<Parameters<WithSingleProp>>(
    ([prop], _, exports) => {
        if (typeof exports === 'object' && prop in exports)
            return Object.keys(exports).length === 1

        return false
    },
    ([prop]) => `revenge.singleProp(${prop})`,
    FilterFlags.RequiresExports,
) as WithSingleProp

export type WithName = FilterGenerator<
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
 * const [SomeComponent] = lookupModule(withName('SomeComponent'))
 * // const SomeComponent: { name: 'SomeComponent' }
 * ```
 *
 * @example Typing as function component
 * ```ts
 * type MyComponent = React.FC<{ foo: string }>
 *
 * const [MyComponent] = lookupModule(withName<MyComponent>('MyComponent'))
 * // const MyComponent: MyComponent & { name: 'MyComponent' }
 * ```
 *
 * @example Typing as class
 * ```
 * interface SomeClass {
 *    someMethod(): void
 * }
 *
 * const [SomeClass] = lookupModule(withName<{ new(param: string): SomeClass }>('SomeClass'))
 * // const SomeClass: { new(): SomeClass, name: 'SomeClass' }
 */
export const withName = createFilterGenerator<Parameters<WithName>>(
    ([name], _, exports) => exports.name === name,
    ([name]) => `revenge.name(${name})`,
    FilterFlags.RequiresExports,
) as WithName

export interface ComparableDependencyMap
    extends Array<
        Metro.ModuleID | number | null | undefined | ComparableDependencyMap
    > {
    l?: boolean
    r?: number
}

type WithDependencies = FilterGenerator<
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
 * @see {@link withDependencies.loose} to loosen the checks.
 * @see {@link withDependencies.relative} to compare dependencies relatively.
 *
 * @example
 * ```ts
 * const { loose, relative } = withDependencies
 *
 * // Logger's module ID is 5
 * // It has 3 dependencies [4, ?, 2]
 *
 * const [Logger] = lookupModule(withDependencies([4, null, 2]))
 * // or
 * const [Logger] = lookupModule(withDependencies([4, , 2]))
 *
 * // Relative dependencies
 * const [Logger] = lookupModule(withDependencies([relative(-1), null, 2]))
 *
 * // Nested dependencies
 * // The last dependency (module ID 2) would need to have zero dependencies:
 * const [Logger] = lookupModule(withDependencies([4, null, []]))
 *
 * // Loose dependencies
 * // Module having these dependencies: [4, ...], [4, ..., ...], [4, ..., ..., ...], etc. would match:
 * const [SomeOtherModule] = lookupModule(withDependencies(loose([4])))
 * ```
 *
 * @example With filter helpers (preferred)
 * ```ts
 * const [Logger] = lookupModule(
 *   withProps('log')
 *     .withDependencies([4, null, 2]),
 * )
 * ```
 */
export const withDependencies = createFilterGenerator<
    Parameters<WithDependencies>
>(
    ([deps], id) => depCompare(getModuleDependencies(id)!, deps, id, id),
    deps => `revenge.deps(${depGenFilterKey(deps)})`,
    FilterFlags.Any,
) as WithDependencies

withDependencies.loose = loose
withDependencies.relative = relative

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
 * @see {@link withDependencies}
 * @see {@link relative}
 *
 * @example
 * ```ts
 * const { relative } = withDependencies
 *
 * // This filter will match modules having one dependency that is its module ID + 1
 * // And module ID + 1 would have exactly two dependencies: [Any, 2]
 * withDependencies(
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
 * Warns the developer about a bad `withDependencies` filter using `undefined` in its comparisons.
 *
 * - `undefined` should only be used as a fallback to when a module ID can really not be found.
 * - Use `null` instead to indicate a dynamic dependency.
 */
function DEBUG_warnBadWithDependenciesFilter(
    deps: ComparableDependencyMap,
    index: number,
) {
    // already warned
    if (__DEBUG_WARNED_BAD_BY_DEPENDENCIES_FILTERS__.has(deps)) return

    nativeLoggingHook(
        `\u001b[33mBad ${withDependencies.name} filter, undefined ID at index ${index} (if intentional, set to null): [${depGenFilterKey(deps)}]\n${getCurrentStack()}\u001b[0m`,
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
            DEBUG_warnBadWithDependenciesFilter(b, i)

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

export type And = FilterGenerator<
    <F1 extends FilterBase, F2 extends FilterBase>(
        f1: F1,
        f2: F2,
    ) => Filter<
        FilterResult<F1> & FilterResult<F2>,
        LogicalOr<IsFilterWithExports<F1>, IsFilterWithExports<F2>>
    >
>

/**
 * Combines two filters into one, returning true if **every** filter matches.
 *
 * @param filters The filters to combine.
 *
 * @example With filter helpers (preferred)
 * ```ts
 * const [SomeModule] = lookupModule(
 *   withProps('x', 'name')
 *     .and(withName('SomeName'))
 *     .and(withDependencies([1, 485, null, 2])),
 * )
 * ```
 *
 * @example
 * ```ts
 * const [SomeModule] = lookupModule(
 *   and(
 *     and(withProps('x', 'name'), withName('SomeName')),
 *     withDependencies([1, 485, null, 2]),
 *   ),
 * )
 * ```
 */
export const and = createFilterGenerator(
    (filters, id, exports) => {
        for (const filter of filters) {
            if (filter(id, exports)) continue
            return false
        }

        return true
    },
    filters => `revenge.and(${filtersToKey(filters)})`,
    filters => filters.reduce((a, b) => a | b.flags, 0),
) as And

export type Or = FilterGenerator<
    <F1 extends FilterBase, F2 extends FilterBase>(
        f1: F1,
        f2: F2,
    ) => Filter<
        FilterResult<F1> | FilterResult<F2>,
        IsFilterWithExports<F1> | IsFilterWithExports<F2>
    >
>

/**
 * Combines two filters into one, returning true if **some** filters match.
 *
 * @param filters The filters to combine.
 *
 * @example With filter helpers (preferred)
 * ```ts
 * const [SomeModule] = lookupModule(
 *   withProps('x', 'name')
 *     .or(withName('SomeName'))
 *     .or(withDependencies([1, 485, null, 2])),
 * )
 * ```
 *
 * @example
 * ```ts
 * const [SomeModule] = lookupModule(
 *   or(
 *     or(withProps('x', 'name'), withName('SomeName')),
 *     withDependencies([1, 485, null, 2]),
 *   ),
 * )
 * ```
 */
export const or = createFilterGenerator(
    (filters, id, exports) => {
        for (const filter of filters) if (filter(id, exports)) return true
        return false
    },
    filters => `revenge.or(${filtersToKey(filters)})`,
    filters => filters.reduce((a, b) => a & b.flags, 0),
) as Or

function filtersToKey(filters: FilterBase[]): string {
    let s = ''
    for (const filter of filters) s += `${filter.key},`
    return s.substring(0, s.length - 1)
}

export type PreferExports = FilterGenerator<
    <WEF extends FilterBase>(
        filter: WEF,
        fallbackFilter: FilterBase<any, false>,
    ) => Filter<FilterResult<WEF>, false>
>

/**
 * Filter modules depending on if their exports are available and filterable.
 *
 * @see {@link isModuleExportsBad} for more information on what is considered bad module exports.
 *
 * @param filter The filter to use for modules with proper exports.
 * @param fallbackFilter The filter to use for modules without proper exports (uninitialized or bad).
 *
 * @example With filter helpers (preferred)
 * ```ts
 * const [SomeModule] = lookupModule(
 *   withDependencies([1, 485, null, 2])
 *     .withExports(withProps('x')),
 * )
 * ```
 *
 * @example
 * ```ts
 * // will filter withProps('x') for modules with proper exports
 * // and withDependencies([1, 485, null, 2]) for without proper exports (uninitialized or bad)
 * const [SomeModule] = lookupModule(preferExports(
 *   withProps('x'),
 *   withDependencies([1, 485, null, 2]),
 * ))
 * ```
 */
export const preferExports = createFilterGenerator<Parameters<PreferExports>>(
    ([filter, fallbackFilter], id, exports) => {
        if (mInitialized.has(id))
            return filter(id, exports) && fallbackFilter(id)

        return fallbackFilter(id)
    },
    ([f1, f2]) => `revenge.preferExports(${f1.key},${f2.key})`,
    FilterFlags.Any,
) as PreferExports
