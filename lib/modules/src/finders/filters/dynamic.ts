import { getCurrentStack } from '@revenge-mod/utils/error'
import { getModuleDependencies } from '../../metro/utils'
import { lookupModule } from '../lookup'
import { FilterScopes } from './constants'
import { createFilterGenerator } from './utils'
import type { Metro } from '../../types'
import type { Filter, FilterGenerator } from './utils'

/** @internal This structure is not stable, and should only be referenced internally. */
export interface ComparableDependencyMap
    extends Array<
        | Metro.ModuleID
        | number
        | null
        | undefined
        | ComparableDependencyMap
        // TODO: (2026-08-29) Remove in a month's time.
        /** @deprecated Resolve the module ID with `lookupModule` and pass the ID. */
        | Filter
    > {
    // partial
    p?: boolean
    // relative
    r?: number
    // skip
    s?: number
    // atLeast
    n?: number
    // atMost
    x?: number
    // unordered
    u?: boolean
    // ordered
    o?: boolean
}

/**
 * Filter modules by their dependency map.
 *
 * @param deps The dependency map to check for, can be a sparse array or have `null` to be any dependency ("dynamic"). **Order and size matters!**
 *
 * To do proper fingerprinting for modules, three things can be tuned.
 *
 * Which slice of the dependency map is compared:
 * @see {@link withDependencies.skip} and {@link withDependencies.last} to move where comparison starts.
 *
 * How strictly the slice is matched:
 * @see {@link withDependencies.partial} to drop the exact length check.
 * @see {@link withDependencies.atLeast} and {@link withDependencies.atMost} to bound the dependency count.
 *
 * How entries are matched inside the slice:
 * @see {@link withDependencies.ordered} to allow gaps between entries.
 * @see {@link withDependencies.unordered} to also drop the order requirement.
 *
 * Individual entries can be compared relatively:
 * @see {@link withDependencies.relative} and {@link relative.within}.
 *
 * @example
 * ```ts
 * const { partial, relative } = withDependencies
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
 * // Partial dependencies
 * // Module having these dependencies: [4, ...], [4, ..., ...], [4, ..., ..., ...], etc. would match:
 * const [SomeOtherModule] = lookupModule(withDependencies(partial([4])))
 *
 * // Deprecated: filters as dependencies
 * // Resolved once with lookupModule when this filter is built, then compared as module IDs
 * const [Module] = lookupModule(withDependencies([withProps('open'), 69]))
 *
 * // Resolve it yourself instead, so the moment it happens is yours to pick
 * const [, OpenId] = lookupModule(withProps('open'))
 * const [Module] = lookupModule(withDependencies([OpenId, 69]))
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
    deps => `revenge.deps(${depGenFilterKey(deps)})`,
    FilterScopes.Uninitialized | FilterScopes.Initialized,
) as WithDependencies

export const withDependencies = Object.assign(
    (deps: ComparableDependencyMap) => {
        // TODO: (2026-08-29) Remove in a month's time, along with filter entries.
        depResolveFilterEntries(deps)

        if (__DEV__) DEBUG_validateWithDependenciesFilter(deps)

        return withDependencies_(deps)
    },
    withDependencies_,
) as WithDependencies

/**
 * Resolves deprecated filter entries to module IDs before comparisons run.
 *
 * @param deps The dependency map to resolve.
 */
// TODO: (2026-08-29) Remove in a month's time.
function depResolveFilterEntries(deps: ComparableDependencyMap) {
    for (let i = 0; i < deps.length; i++) {
        const dep = deps[i]
        if (dep == null) continue

        if (typeof dep === 'function') {
            const [, id] = lookupModule(dep)

            if (id === undefined) warnUnresolvedFilterDependency(deps, i, dep)
            else if (__DEV__) DEBUG_warnFilterDependency(deps, i, dep, id)

            // Unresolved entries must never match, and NaN equals no module ID
            deps[i] = id ?? NaN
        } else if (typeof dep === 'object') depResolveFilterEntries(dep)
    }
}

withDependencies.partial = partial
withDependencies.relative = relative
withDependencies.skip = skip
withDependencies.last = last
withDependencies.atLeast = atLeast
withDependencies.atMost = atMost
withDependencies.unordered = unordered
withDependencies.ordered = ordered

withDependencies.loose = partial
withDependencies.includes = unordered

type WithDependencies = FilterGenerator<
    <T>(deps: ComparableDependencyMap) => Filter<{
        Result: T
        Scopes: [
            typeof FilterScopes.Uninitialized,
            typeof FilterScopes.Initialized,
        ]
    }>
> & {
    partial: typeof partial
    relative: typeof relative
    skip: typeof skip
    last: typeof last
    atLeast: typeof atLeast
    atMost: typeof atMost
    unordered: typeof unordered
    ordered: typeof ordered
    // TODO: (2026-08-29) Remove this in a month's time.
    /** @deprecated Use {@link withDependencies.partial} instead. */
    loose: typeof partial
    /** @deprecated Use {@link withDependencies.unordered} instead. */
    includes: typeof unordered
}

/**
 * Compare the set without requiring it to reach the end of the dependency map.
 *
 * On its own this matches the **leading** dependencies. Can be used with {@link withDependencies.skip}.
 *
 * Order still matters. If you mark an index as dynamic, the same index must also be present during comparison to pass.
 *
 * @param deps The dependency map to compare partially. This permanently modifies the array.
 * @returns The modified dependency map.
 *
 * @see {@link withDependencies.last} for the trailing counterpart.
 */
function partial(deps: ComparableDependencyMap) {
    deps.p = true
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
 * This implies {@link withDependencies.partial}, as an exact length check would never pass alongside a bound.
 *
 * @param count The minimum amount of dependencies.
 * @param deps The dependency map to bound. This permanently modifies the array.
 * @returns The modified dependency map.
 */
function atLeast(count: number, deps: ComparableDependencyMap = []) {
    deps.n = count
    deps.p = true
    return deps
}

/**
 * Require the module to have at most `count` dependencies.
 *
 * This implies {@link withDependencies.partial}, as an exact length check would never pass alongside a bound.
 *
 * @param count The maximum amount of dependencies.
 * @param deps The dependency map to bound. This permanently modifies the array.
 * @returns The modified dependency map.
 */
function atMost(count: number, deps: ComparableDependencyMap = []) {
    deps.x = count
    deps.p = true
    return deps
}

/**
 * Compare the set in order, allowing any number of unrelated dependencies between the entries.
 *
 * Entries must appear in the given order. Gaps before, between and after them are unconstrained.
 * Dynamic (`null`) entries consume one dependency slot.
 *
 * Each entry takes the earliest dependency satisfying it. That is exact for subsequences,
 * so entries matching overlapping dependencies never cause a false negative.
 *
 * @param deps The dependency map to compare as a subsequence. This permanently modifies the array.
 * @returns The modified dependency map.
 *
 * @see {@link withDependencies.unordered} to drop the order requirement too.
 *
 * @example
 * ```ts
 * const { ordered, relative } = withDependencies
 *
 * // Matches modules depending on module ID 4, then its own next module, in that order,
 * // with any number of other dependencies around them
 * withDependencies(ordered([4, relative(1)]))
 * ```
 */
function ordered(deps: ComparableDependencyMap) {
    deps.o = true
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
 *
 * @see {@link withDependencies.ordered} to keep the order requirement.
 */
function unordered(deps: ComparableDependencyMap) {
    if (__DEV__)
        for (let i = 0; i < deps.length; i++)
            if (deps[i] == null) DEBUG_warnBadUnorderedDependency(deps, i)

    deps.u = true
    return deps
}

const RelativeSignBit = 1 << 30
const RelativeBit = 1 << 29
const RelativeRootBit = 1 << 28
const RelativeRangeBit = 1 << 27
// Span occupies bits 20 to 26
const RelativeSpanShift = 20
const RelativeSpanMask = 0x7f
const RelativeMagnitudeMask = (1 << RelativeSpanShift) - 1

/**
 * Marks this dependency to compare relatively to the module ID being compared.
 *
 * @param magnitude The relative magnitude to use when comparing module IDs. Positive values mean the dependency's module ID is greater than the module being compared, negative values mean it's less.
 * @param root Marks this dependency to compare relatively to the root (returning) module ID being compared. Useful for nested comparisons where you want to compare by the root module ID instead of the parent's module ID of the nested dependency.
 *
 * @see {@link relative.within} to accept a range of magnitudes.
 */
function relative(magnitude: Metro.ModuleID, root?: boolean) {
    if (__DEV__ && Math.abs(magnitude) > RelativeMagnitudeMask)
        DEBUG_warnBadRelativeRange(
            `relative(${magnitude}) overflows, magnitudes are capped at ${RelativeMagnitudeMask}`,
        )

    magnitude =
        (magnitude < 0 ? -magnitude | RelativeSignBit : magnitude) | RelativeBit
    if (root) magnitude |= RelativeRootBit
    return magnitude
}

/**
 * Marks this dependency to compare relatively to the module ID being compared, accepting any magnitude within the range.
 *
 * Use it when a sibling module can shift in the IDs between app versions.
 * Try to keep the range small and combine with exports-based filter.
 *
 * @param min The smallest relative magnitude to accept.
 * @param max The largest relative magnitude to accept. Must share the sign of `min`.
 * @param root Marks this dependency to compare relatively to the root (returning) module ID being compared.
 *
 * @see {@link relative} for an exact magnitude.
 *
 * @example
 * ```ts
 * const { relative } = withDependencies
 *
 * // Second dependency is the module's own ID + 2, + 3, or + 4
 * withDependencies([null, relative.within(2, 4)])
 * ```
 */
relative.within = (
    min: Metro.ModuleID,
    max: Metro.ModuleID,
    root?: boolean,
) => {
    const negative = min < 0 || max < 0

    if (__DEV__) {
        if (min < 0 !== max < 0)
            DEBUG_warnBadRelativeRange(
                `relative.within(${min}, ${max}) mixes signs, it can never match`,
            )
        else if (Math.abs(max) < Math.abs(min))
            DEBUG_warnBadRelativeRange(
                `relative.within(${min}, ${max}) is inverted, ${max} is closer to zero than ${min}`,
            )
    }

    const lo = Math.min(Math.abs(min), Math.abs(max))
    const span = Math.max(Math.abs(min), Math.abs(max)) - lo

    if (__DEV__) {
        if (lo > RelativeMagnitudeMask)
            DEBUG_warnBadRelativeRange(
                `relative.within(${min}, ${max}) overflows, magnitudes are capped at ${RelativeMagnitudeMask}`,
            )
        if (span > RelativeSpanMask)
            DEBUG_warnBadRelativeRange(
                `relative.within(${min}, ${max}) overflows, spans are capped at ${RelativeSpanMask}`,
            )
    }

    let dep = lo | (span << RelativeSpanShift) | RelativeBit | RelativeRangeBit
    if (negative) dep |= RelativeSignBit
    if (root) dep |= RelativeRootBit
    return dep
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
 * Warns the developer about a dynamic dependency in a `withDependencies.unordered` set, which matches anything and is therefore a no-op.
 */
function DEBUG_warnBadUnorderedDependency(
    deps: ComparableDependencyMap,
    index: number,
) {
    nativeLoggingHook(
        `\u001b[33mBad withDependencies.unordered set, dynamic ID at index ${index} matches anything: [${depGenFilterKey(deps)}]\n${getCurrentStack()}\u001b[0m`,
        2,
    )
}

/**
 * Warns the developer about a deprecated filter entry, and reports the module ID it resolved to.
 */
// TODO: (2026-08-29) Remove in a month's time.
function DEBUG_warnFilterDependency(
    deps: ComparableDependencyMap,
    index: number,
    filter: Filter,
    id: Metro.ModuleID,
) {
    nativeLoggingHook(
        `\u001b[33mDeprecated withDependencies filter entry at index ${index}, resolved ${filter.key} to module ${id}. Pass the module ID instead: [${depGenFilterKey(deps)}]\n${getCurrentStack()}\u001b[0m`,
        2,
    )
}

/**
 * Warns the developer about a filter entry matching no module, leaving a map that can never match.
 */
// TODO: (2026-08-29) Remove in a month's time.
function warnUnresolvedFilterDependency(
    deps: ComparableDependencyMap,
    index: number,
    filter: Filter,
) {
    nativeLoggingHook(
        `\u001b[33mwithDependencies filter entry at index ${index} matched no module, so this filter can never match. Resolve ${filter.key} yourself and pass the module ID: [${depGenFilterKey(deps)}]\n${getCurrentStack()}\u001b[0m`,
        2,
    )
}

/**
 * Warns the developer about a relative comparison that can never match.
 */
function DEBUG_warnBadRelativeRange(reason: string) {
    nativeLoggingHook(
        `\u001b[33mBad withDependencies filter, ${reason}\n${getCurrentStack()}\u001b[0m`,
        2,
    )
}

/**
 * Warns the developer about modifiers that contradict, are already implied by, or are silently ignored by the set being compared.
 */
function DEBUG_warnBadDependencyModifiers(
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

    if (deps.o) {
        if (deps.u)
            DEBUG_warnBadDependencyModifiers(
                deps,
                'ordered() and unordered() contradict, unordered() wins',
            )
        if (skip !== undefined)
            DEBUG_warnBadDependencyModifiers(
                deps,
                `ordered() ignores ${skip === Infinity ? 'last()' : `skip(${skip})`}, ordered sets have no window`,
            )
    }

    // last() returns before the length check, so partial() can never affect it
    if (deps.p && skip === Infinity)
        DEBUG_warnBadDependencyModifiers(
            deps,
            'partial() does nothing alongside last(), the set is already anchored to the end',
        )

    // The lowest dependency count the set itself can match.
    // Unordered sets have no window, so they only ever constrain the count through bounds.
    // Ordered sets consume one dependency per entry, including dynamic ones.
    const floor = deps.u
        ? 0
        : deps.o
          ? deps.length
          : (skip === undefined || skip === Infinity ? 0 : skip) + deps.length

    if (max !== undefined && max < floor)
        DEBUG_warnBadDependencyModifiers(
            deps,
            `atMost(${max}) can never match, the set requires at least ${floor} dependencies`,
        )
    else if (min !== undefined && max !== undefined && min > max)
        DEBUG_warnBadDependencyModifiers(
            deps,
            `atLeast(${min}) can never match, atMost(${max}) is lower`,
        )
    else if (min !== undefined && min <= floor)
        DEBUG_warnBadDependencyModifiers(
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

    if (b.u) return depUnorderedCompare(a, b, root, parent)
    if (b.o) return depOrderedCompare(a, b, root, parent)

    // Index in a where positional comparison starts
    let start = 0
    const skip = b.s

    if (skip === undefined) {
        if (b.p ? lenA < lenB : lenA !== lenB) return false
    } else if (skip === Infinity) {
        // Anchor to the end, so everything before the last lenB dependencies is unconstrained
        start = lenA - lenB
        if (start < 0) return false
    } else {
        start = skip
        if (b.p ? lenA < start + lenB : lenA !== start + lenB) return false
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

function depOrderedCompare(
    a: Metro.ModuleID[],
    b: ComparableDependencyMap,
    root: Metro.ModuleID,
    parent: Metro.ModuleID,
): boolean {
    const lenA = a.length
    const lenB = b.length

    // Cursor into a, only ever moving forward, so the walk is linear
    let cursor = 0

    for (let i = 0; i < lenB; i++) {
        const compare = b[i]

        if (__DEV__ && compare === undefined)
            DEBUG_warnBadWithDependenciesFilter(b, i)

        // Dynamic entries consume one dependency
        if (compare == null) {
            if (cursor >= lenA) return false
            cursor++
            continue
        }

        let found = false

        while (cursor < lenA) {
            const id = a[cursor++]
            if (id !== null && depMatches(compare, id, root, parent)) {
                found = true
                break
            }
        }

        if (!found) return false
    }

    return true
}

function depUnorderedCompare(
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
    // Filter entries are resolved to module IDs when the filter is built, so only IDs and nested maps reach here
    if (typeof compare === 'object') {
        // relative.withDependencies?
        if (compare.r && !depShallowCompare(compare.r, id, root, parent))
            return false

        return depCompare(getModuleDependencies(id)!, compare, root, id)
    }

    // TODO: (2026-08-29) Remove typecast in a month's time.
    return depShallowCompare(compare as number, id, root, parent)
}

function depShallowCompare(
    compare: number,
    id: Metro.ModuleID,
    root: Metro.ModuleID,
    parent: Metro.ModuleID,
) {
    // relative?
    if (compare & RelativeBit) {
        const base = compare & RelativeRootBit ? root : parent
        const magnitude = depGetRelMagnitude(compare)

        // relative.within?
        if (compare & RelativeRangeBit) {
            const from = base + magnitude
            const to = from + (magnitude < 0 ? -1 : 1) * depGetRelSpan(compare)

            return magnitude < 0
                ? id <= from && id >= to
                : id >= from && id <= to
        }

        compare = base + magnitude
    }

    return compare === id
}

function depGetRelMagnitude(dep: number) {
    const sign = dep & RelativeSignBit
    dep = dep & RelativeMagnitudeMask
    if (sign) dep = -dep
    return dep
}

function depGetRelSpan(dep: number) {
    return (dep >> RelativeSpanShift) & RelativeSpanMask
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

    if (deps.u) key += 'u'
    if (deps.o) key += 'o'
    if (deps.p) key += 'p'
    if (deps.n !== undefined) key += `>${deps.n}`
    if (deps.x !== undefined) key += `<${deps.x}`
    if (deps.s !== undefined) key += `s${deps.s === Infinity ? '*' : deps.s}`
    // relative.withDependencies?
    if (deps.r) key += `${depGenRelativeKeyPart(deps.r)}:`

    return key
}

function depGenRelativeKeyPart(dep: number) {
    const magnitude = depGetRelMagnitude(dep)
    const prefix = dep & RelativeRootBit ? '~' : '^'

    if (dep & RelativeRangeBit) {
        const span = depGetRelSpan(dep)
        return `${prefix}${magnitude}..${magnitude < 0 ? magnitude - span : magnitude + span}`
    }

    return `${prefix}${magnitude}`
}
