import { getCurrentStack } from '@revenge-mod/utils/error'
import {
    getInitializedModuleExports,
    getModuleDependencies,
} from '../../metro/utils'
import { runFilter } from '../_internal'
import { FilterScopes } from './constants'
import { createFilterGenerator } from './utils'
import type { Metro } from '../../types'
import type { Filter, FilterGenerator } from './utils'

export interface ComparableDependencyMap
    extends Array<
        | Metro.ModuleID
        | number
        | null
        | undefined
        | ComparableDependencyMap
        | Filter
    > {
    // loose
    l?: boolean
    // relative
    r?: number
    // skip
    s?: number
    // atLeast
    n?: number
    // atMost
    x?: number
    // includes
    i?: boolean
}

/**
 * Filter modules by their dependency map.
 *
 * @param deps The dependency map to check for, can be a sparse array or have `null` to be any dependency ("dynamic"). **Order and size matters!**
 *
 * To do proper fingerprinting for modules:
 * @see {@link withDependencies.loose} to loosen the checks.
 * @see {@link withDependencies.relative} to compare dependencies relatively.
 * @see {@link withDependencies.skip} and {@link withDependencies.last} to move where comparison starts.
 * @see {@link withDependencies.atLeast} and {@link withDependencies.atMost} to bound the dependency count.
 * @see {@link withDependencies.includes} to compare without caring about order.
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
 *
 * // Using filters as dependencies
 * // Match modules with specific exports in their dependencies
 * const [Module] = lookupModule(withDependencies([
 *   withProps('open'), // first dependency must have an 'open' property
 *   withName('MyComponent'), // second dependency must have name === 'MyComponent'
 *   69, // third dependency must be module ID 69
 *   null, // fourth dependency can be anything
 *   420, // fifth dependency must be module ID 420
 *   2 // sixth dependency must be module ID 2
 * ]))
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
const withDependencies_ = createFilterGenerator<Parameters<WithDependencies>>(
    ([deps], id) => depCompare(getModuleDependencies(id)!, deps, id, id),
    // The dep map is keyed as a nested set, so its modifiers are already part of the key
    deps => `revenge.deps(${depGenFilterKey(deps)})`,
    FilterScopes.Uninitialized | FilterScopes.Initialized,
) as WithDependencies

export const withDependencies = __DEV__
    ? (Object.assign((deps: ComparableDependencyMap) => {
          DEBUG_validateWithDependenciesFilter(deps)

          return withDependencies_(deps)
      }, withDependencies_) as WithDependencies)
    : withDependencies_

withDependencies.loose = loose
withDependencies.relative = relative
withDependencies.skip = skip
withDependencies.last = last
withDependencies.atLeast = atLeast
withDependencies.atMost = atMost
withDependencies.includes = includes

type WithDependencies = FilterGenerator<
    <T>(deps: ComparableDependencyMap) => Filter<{
        Result: T
        Scopes: [
            typeof FilterScopes.Uninitialized,
            typeof FilterScopes.Initialized,
        ]
    }>
> & {
    loose: typeof loose
    relative: typeof relative
    skip: typeof skip
    last: typeof last
    atLeast: typeof atLeast
    atMost: typeof atMost
    includes: typeof includes
}

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

/**
 * Skip a number of dependencies before comparing positionally.
 *
 * Passing `Infinity` anchors the set to the end, matching the **last** `deps.length` dependencies.
 * Anything before them is unconstrained.
 *
 * @param amount The amount of dependencies to skip from the start, or `Infinity` to anchor to the end.
 * @param deps The dependency map to skip in. This permanently modifies the array.
 * @returns The modified dependency map.
 *
 * @see {@link withDependencies.last} for the `Infinity` shorthand.
 */
function skip(amount: number, deps: ComparableDependencyMap = []) {
    deps.s = amount
    return deps
}

/**
 * Match the **last** `deps.length` dependencies, leaving anything before them unconstrained.
 *
 * Shorthand for {@link withDependencies.skip} with `Infinity`.
 * Prefer this over leading comparisons when a module's trailing dependencies are the stable part of its fingerprint.
 *
 * @param deps The dependency map to anchor to the end. This permanently modifies the array.
 * @returns The modified dependency map.
 *
 * @example
 * ```ts
 * const { last, relative } = withDependencies
 *
 * // Matches modules whose last three dependencies are [Any, module ID + 1, 2]
 * withDependencies(last([null, relative(1), 2]))
 * ```
 */
function last(deps: ComparableDependencyMap = []) {
    deps.s = Infinity
    return deps
}

/**
 * Require the module to have at least `count` dependencies.
 *
 * This implies {@link withDependencies.loose}, as an exact length check would never pass alongside a bound.
 *
 * @param count The minimum amount of dependencies.
 * @param deps The dependency map to bound. This permanently modifies the array.
 * @returns The modified dependency map.
 */
function atLeast(count: number, deps: ComparableDependencyMap = []) {
    deps.n = count
    deps.l = true
    return deps
}

/**
 * Require the module to have at most `count` dependencies.
 *
 * This implies {@link withDependencies.loose}, as an exact length check would never pass alongside a bound.
 *
 * @param count The maximum amount of dependencies.
 * @param deps The dependency map to bound. This permanently modifies the array.
 * @returns The modified dependency map.
 */
function atMost(count: number, deps: ComparableDependencyMap = []) {
    deps.x = count
    deps.l = true
    return deps
}

/**
 * Compare the set without caring about order or position, only that every dependency exists somewhere.
 *
 * Entries are matched independently, so two identical entries can both match the same dependency.
 * Dynamic (`null`) entries are meaningless here and are ignored.
 *
 * **This is much more expensive than positional comparison**, as every entry is compared against every dependency.
 * Bound it with {@link withDependencies.atLeast} or {@link withDependencies.atMost} where possible, as those are checked first.
 *
 * @param deps The dependency map to compare unordered. This permanently modifies the array.
 * @returns The modified dependency map.
 */
function includes(deps: ComparableDependencyMap) {
    if (__DEV__)
        for (let i = 0; i < deps.length; i++)
            if (deps[i] == null) DEBUG_warnBadIncludesDependency(deps, i)

    deps.i = true
    return deps
}

const RelativeSignBit = 1 << 30
const RelativeBit = 1 << 29
const RelativeRootBit = 1 << 28
const RelativeBitMask = ~(RelativeSignBit | RelativeBit | RelativeRootBit)

/**
 * Marks this dependency to compare relatively to the module ID being compared.
 *
 * @param magnitude The relative magnitude to use when comparing module IDs. Positive values mean the dependency's module ID is greater than the module being compared, negative values mean it's less.
 * @param root Marks this dependency to compare relatively to the root (returning) module ID being compared. Useful for nested comparisons where you want to compare by the root module ID instead of the parent's module ID of the nested dependency.
 */
function relative(magnitude: Metro.ModuleID, root?: boolean) {
    magnitude =
        (magnitude < 0 ? -magnitude | RelativeSignBit : magnitude) | RelativeBit
    if (root) magnitude |= RelativeRootBit
    return magnitude
}

/**
 * Marks this dependency to compare relatively to the module ID being compared, with an additional dependencies check.
 *
 * @param deps The dependency map to add the relative dependency to. This permanently modifies the array.
 * @param magnitude The relative magnitude to use when comparing module IDs. Positive values mean the dependency's module ID is greater than the module being compared, negative values mean it's less.
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
    magnitude: Metro.ModuleID,
    root?: boolean,
) => {
    deps.r = relative(magnitude, root)
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
    nativeLoggingHook(
        `\u001b[33mBad withDependencies filter, undefined ID at index ${index} (if intentional, set to null): [${depGenFilterKey(deps)}]\n${getCurrentStack()}\u001b[0m`,
        2,
    )
}

/**
 * Warns the developer about a dynamic dependency in a `withDependencies.includes` set, which matches anything and is therefore a no-op.
 */
function DEBUG_warnBadIncludesDependency(
    deps: ComparableDependencyMap,
    index: number,
) {
    nativeLoggingHook(
        `\u001b[33mBad withDependencies.includes set, dynamic ID at index ${index} matches anything: [${depGenFilterKey(deps)}]\n${getCurrentStack()}\u001b[0m`,
        2,
    )
}

/**
 * Warns the developer about dependency count bounds that contradict, or are already implied by, the set being compared.
 */
function DEBUG_warnBadDependencyBounds(
    deps: ComparableDependencyMap,
    reason: string,
) {
    nativeLoggingHook(
        `\u001b[33mBad withDependencies filter, ${reason}: [${depGenFilterKey(deps)}]\n${getCurrentStack()}\u001b[0m`,
        2,
    )
}

/**
 * Validates a dependency map and its nested sets, warning about mistakes that would otherwise silently never match.
 */
function DEBUG_validateWithDependenciesFilter(deps: ComparableDependencyMap) {
    const { n: min, x: max, s: skip } = deps

    // The lowest dependency count the set itself can match.
    // Unordered sets have no window, so they only ever constrain the count through bounds.
    const floor = deps.i
        ? 0
        : (skip === undefined || skip === Infinity ? 0 : skip) + deps.length

    if (max !== undefined && max < floor)
        DEBUG_warnBadDependencyBounds(
            deps,
            `atMost(${max}) can never match, the set requires at least ${floor} dependencies`,
        )
    else if (min !== undefined && max !== undefined && min > max)
        DEBUG_warnBadDependencyBounds(
            deps,
            `atLeast(${min}) can never match, atMost(${max}) is lower`,
        )
    else if (min !== undefined && min <= floor)
        DEBUG_warnBadDependencyBounds(
            deps,
            `atLeast(${min}) does nothing, the set already requires at least ${floor} dependencies`,
        )

    for (let i = 0; i < deps.length; i++) {
        const dep = deps[i]

        // Warn about using undefined in deps, which is likely a mistake
        if (dep === undefined) DEBUG_warnBadWithDependenciesFilter(deps, i)
        else if (typeof dep === 'object' && dep !== null)
            DEBUG_validateWithDependenciesFilter(dep)
    }
}

function depCompare(
    a: Metro.ModuleID[],
    b: ComparableDependencyMap,
    root: Metro.ModuleID,
    parent: Metro.ModuleID,
): boolean {
    const lenA = a.length
    const lenB = b.length

    const min = b.n
    if (min !== undefined && lenA < min) return false

    const max = b.x
    if (max !== undefined && lenA > max) return false

    if (b.i) return depIncludesCompare(a, b, root, parent)

    // Index in a where positional comparison starts
    let start = 0
    const skip = b.s

    if (skip === undefined) {
        if (b.l ? lenA < lenB : lenA !== lenB) return false
    } else if (skip === Infinity) {
        // Anchor to the end, so everything before the last lenB dependencies is unconstrained
        start = lenA - lenB
        if (start < 0) return false
    } else {
        start = skip
        if (b.l ? lenA < start + lenB : lenA !== start + lenB) return false
    }

    for (let i = 0; i < lenB; i++) {
        const compare = b[i]

        if (__DEV__ && compare === undefined)
            DEBUG_warnBadWithDependenciesFilter(b, i)

        // Skip dynamic
        if (compare == null) continue

        const id = a[start + i]

        // Very rare case where a module dependency has an unused `null` dependency
        // TODO: Probably a Metro/Discord bug?
        if (id === null) return false

        if (!depMatches(compare, id, root, parent)) return false
    }

    return true
}

function depIncludesCompare(
    a: Metro.ModuleID[],
    b: ComparableDependencyMap,
    root: Metro.ModuleID,
    parent: Metro.ModuleID,
): boolean {
    const lenA = a.length

    for (let i = 0; i < b.length; i++) {
        const compare = b[i]

        // Dynamic dependencies match anything, so they carry no meaning when unordered
        if (compare == null) continue

        let found = false

        for (let j = 0; j < lenA; j++) {
            const id = a[j]
            if (id !== null && depMatches(compare, id, root, parent)) {
                found = true
                break
            }
        }

        if (!found) return false
    }

    return true
}

function depMatches(
    compare: NonNullable<ComparableDependencyMap[number]>,
    id: Metro.ModuleID,
    root: Metro.ModuleID,
    parent: Metro.ModuleID,
): boolean {
    switch (typeof compare) {
        case 'function':
            return !!runFilter(compare, id, getInitializedModuleExports(id))
        case 'object': {
            const nested = compare

            // relative.withDependencies?
            if (nested.r && !depShallowCompare(nested.r, id, root, parent))
                return false

            return depCompare(getModuleDependencies(id)!, nested, root, id)
        }
        default:
            return depShallowCompare(compare, id, root, parent)
    }
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
    const sign = dep & RelativeSignBit
    dep = dep & RelativeBitMask
    if (sign) dep = -dep
    return dep
}

function depGenFilterKey(deps: ComparableDependencyMap): string {
    let key = ''

    for (let i = 0; i < deps.length; i++) {
        const dep = deps[i]

        if (dep == null) {
            key += ','
            continue
        }

        switch (typeof dep) {
            case 'function': {
                // It's a filter function
                const filter = dep as any
                key += `${filter.key},`
                break
            }
            case 'object': {
                // It's a nested dependency array
                const nested = dep as ComparableDependencyMap
                key += `${depGenModifierKey(nested)}[${depGenFilterKey(nested)}],`
                break
            }
            default: {
                const numDep = dep as number
                if (numDep & RelativeBit)
                    key += `${depGenRelativeKeyPart(numDep)},`
                else key += `${numDep},`
                break
            }
        }
    }

    return key.substring(0, key.length - 1)
}

function depGenModifierKey(deps: ComparableDependencyMap): string {
    let key = ''

    if (deps.i) key += '?'
    if (deps.l) key += '#'
    if (deps.n !== undefined) key += `>${deps.n}`
    if (deps.x !== undefined) key += `<${deps.x}`
    if (deps.s !== undefined) key += `+${deps.s === Infinity ? '*' : deps.s}`
    // relative.withDependencies?
    if (deps.r) key += `${depGenRelativeKeyPart(deps.r)}:`

    return key
}

function depGenRelativeKeyPart(dep: number) {
    const magnitude = depGetRelMagnitude(dep)
    const prefix = dep & RelativeRootBit ? '~' : '^'
    return `${prefix}${magnitude}`
}
