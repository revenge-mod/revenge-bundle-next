import { FilterScopes } from '.'
import { createFilterGenerator } from './utils'
import type { Metro } from '@revenge-mod/modules/types'
import type {
    Filter,
    FilterBase,
    FilterGenerator,
    FilterInfoOf,
    FilterScopeValue,
    MergeFilterInfo,
    UnionFilterInfo,
} from '.'

/** {@link FilterScopes.All} sets no predicate assumptions. Only {@link FilterScopes.Uninitialized} implies exportless. */
const canFilterUninitialized = (scopes: FilterScopeValue) =>
    Boolean(scopes & FilterScopes.Uninitialized)

/**
 * If both or neither can filter uninitialized, positional order is preserved.
 *
 * If only one can, the one that can will be used as a prefilter for uninitialized modules,
 * and the other will only run on initialized modules.
 */
const compositeHandler = <G extends (a: FilterBase, b: FilterBase) => any>(
    directHandler: G,
    prefilteredHandler: G,
) =>
    ((a, b) => {
        const ea = canFilterUninitialized(a.scopes)
        return ea === canFilterUninitialized(b.scopes)
            ? directHandler(a, b)
            : ea
              ? prefilteredHandler(b, a)
              : prefilteredHandler(a, b)
    }) as G

const compositeArrayHandler = <
    G extends (args: [a: FilterBase, b: FilterBase]) => any,
>(
    directHandler: G,
    prefilteredHandler: G,
) =>
    (([a, b]) => {
        const ea = canFilterUninitialized(a.scopes)
        return ea === canFilterUninitialized(b.scopes)
            ? directHandler([a, b])
            : ea
              ? prefilteredHandler([b, a])
              : prefilteredHandler([a, b])
    }) as G

export type AllOf = FilterGenerator<
    <F1 extends FilterBase, F2 extends FilterBase>(
        f1: F1,
        f2: F2,
    ) => Filter<MergeFilterInfo<FilterInfoOf<F1>, FilterInfoOf<F2>>>
>

/** @deprecated Use {@link AllOf} instead */
export type And = AllOf

const allOfKeyGenerator = ([a, b]: Parameters<AllOf>) =>
    `revenge.allOf(${a.key},${b.key})`

const allOfScopesGenerator = ([a, b]: Parameters<AllOf>) => a.scopes | b.scopes

const directAllOf = createFilterGenerator(
    ([a, b], id, exports, initialized) =>
        a(id, exports, initialized) && b(id, exports, initialized),
    allOfKeyGenerator,
    allOfScopesGenerator,
) as AllOf

const allOfPrefilterCache = new WeakMap<FilterBase, Set<Metro.ModuleID>>()

const prefilteredAllOf = createFilterGenerator(
    ([filter, prefilter], id, exports, initialized) => {
        if (initialized) {
            if (filter(id, exports, true)) {
                // Avoid running the prefilter again if we already know it passed
                const cache = allOfPrefilterCache.get(prefilter)
                return (
                    // biome-ignore lint/complexity/useOptionalChain: Hot path should be optimized
                    (cache && cache.has(id)) || prefilter(id, exports, true)
                )
            }

            return false
        }

        const result = prefilter(id, undefined, false)
        if (result) {
            // Cache prefilter hits to avoid calling the prefilter again
            // Prefilters are usually more expensive
            let set = allOfPrefilterCache.get(prefilter)
            if (!set) allOfPrefilterCache.set(prefilter, (set = new Set()))
            set.add(id)
        }
        return result
    },
    allOfKeyGenerator,
    allOfScopesGenerator,
) as AllOf

/**
 * Combines two filters into one, returning true if **every** filter matches.
 *
 * If only one of the filters can run on uninitialized modules ({@link FilterScopes.Uninitialized}),
 * it is used as the prefilter for uninitialized modules, and the other only runs once a candidate is initialized.
 *
 * @param filters The filters to combine.
 *
 * @example With filter helpers
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
 *   allOf(
 *     allOf(withProps('x', 'name'), withName('SomeName')),
 *     withDependencies([1, 485, null, 2]),
 *   ),
 * )
 * ```
 */
export const allOf = Object.assign(
    compositeHandler(directAllOf, prefilteredAllOf),
    {
        keyFor: compositeArrayHandler(
            directAllOf.keyFor,
            prefilteredAllOf.keyFor,
        ),
        defaultScopesFor: compositeArrayHandler(
            directAllOf.defaultScopesFor,
            prefilteredAllOf.defaultScopesFor,
        ),
    },
) satisfies AllOf

/** @deprecated Use {@link allOf} instead. */
export const and = allOf

export type AnyOf = FilterGenerator<
    <F1 extends FilterBase, F2 extends FilterBase>(
        f1: F1,
        f2: F2,
    ) => Filter<UnionFilterInfo<FilterInfoOf<F1>, FilterInfoOf<F2>>>
>

/** @deprecated Use {@link AnyOf} instead. */
export type Or = AnyOf

const anyOfKeyGenerator = ([a, b]: Parameters<AnyOf>) =>
    `revenge.anyOf(${a.key},${b.key})`

const anyOfScopesGenerator = ([a, b]: Parameters<AnyOf>) => a.scopes | b.scopes

const directAnyOf = createFilterGenerator(
    ([a, b], id, exports, initialized) =>
        a(id, exports, initialized) || b(id, exports, initialized),
    anyOfKeyGenerator,
    anyOfScopesGenerator,
) as AnyOf

const prefilteredAnyOf = createFilterGenerator(
    ([filter, prefilter], id, exports, initialized) => {
        // TODO(PalmDevs): Potential optimization: Add prefilter cache here too?
        if (initialized)
            return filter(id, exports, true) || prefilter(id, exports, true)
        return prefilter(id, undefined, false)
    },
    anyOfKeyGenerator,
    anyOfScopesGenerator,
) as AnyOf

/**
 * Combines two filters into one, returning true if **some** filters match.
 *
 * @param filters The filters to combine.
 *
 * @example With filter helpers
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
 *   anyOf(
 *     anyOf(withProps('x', 'name'), withName('SomeName')),
 *     withDependencies([1, 485, null, 2]),
 *   ),
 * )
 * ```
 */
export const anyOf = Object.assign(
    compositeHandler<AnyOf>(directAnyOf, prefilteredAnyOf),
    {
        keyFor: compositeArrayHandler(
            directAnyOf.keyFor,
            prefilteredAnyOf.keyFor,
        ),
        defaultScopesFor: compositeArrayHandler(
            directAnyOf.defaultScopesFor,
            prefilteredAnyOf.defaultScopesFor,
        ),
    },
) satisfies AnyOf

/** @deprecated Use {@link anyOf} instead. */
export const or = anyOf
