import { getCurrentStack } from '@revenge-mod/utils/error'
import { getModuleDependencies } from '../../metro/utils'
import { FilterFlag } from './constants'
import { createFilterGenerator } from './utils'
import type { Metro } from '../../types'
import type { Filter, FilterGenerator } from './utils'

export interface ComparableDependencyMap
    extends Array<
        Metro.ModuleID | number | null | undefined | ComparableDependencyMap
    > {
    l?: boolean
    r?: number
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
    FilterFlag.Dynamic,
) as WithDependencies

withDependencies.loose = loose
withDependencies.relative = relative

type WithDependencies = FilterGenerator<
    <T>(deps: ComparableDependencyMap) => Filter<T, false>
> & {
    loose: typeof loose
    relative: typeof relative
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
