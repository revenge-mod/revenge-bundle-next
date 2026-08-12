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

export type And = FilterGenerator<
    <F1 extends FilterBase, F2 extends FilterBase>(
        f1: F1,
        f2: F2,
    ) => Filter<MergeFilterInfo<FilterInfoOf<F1>, FilterInfoOf<F2>>>
>

const andKeyGenerator = ([a, b]: Parameters<And>) =>
    `revenge.and(${a.key},${b.key})`

const andScopesGenerator = ([a, b]: Parameters<And>) => a.scopes | b.scopes

const directAnd = createFilterGenerator(
    ([a, b], id, exports, initialized) =>
        a(id, exports, initialized) && b(id, exports, initialized),
    andKeyGenerator,
    andScopesGenerator,
) as And

const andPrefilterCache = new WeakMap<FilterBase, Set<Metro.ModuleID>>()

const prefilteredAnd = createFilterGenerator(
    ([filter, prefilter], id, exports, initialized) => {
        if (initialized) {
            if (filter(id, exports, true)) {
                // Avoid running the prefilter again if we already know it passed
                const cache = andPrefilterCache.get(prefilter)
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
            let set = andPrefilterCache.get(prefilter)
            if (!set) andPrefilterCache.set(prefilter, (set = new Set()))
            set.add(id)
        }
        return result
    },
    andKeyGenerator,
    andScopesGenerator,
) as And

/**
 * Combines two filters into one, returning true if **every** filter matches.
 *
 * If only one of the filters can run on uninitialized modules ({@link FilterScopes.Uninitialized}),
 * it is used as the prefilter for uninitialized modules, and the other only runs once a candidate is initialized.
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
export const and = Object.assign(compositeHandler(directAnd, prefilteredAnd), {
    keyFor: compositeArrayHandler(directAnd.keyFor, prefilteredAnd.keyFor),
    defaultScopesFor: compositeArrayHandler(
        directAnd.defaultScopesFor,
        prefilteredAnd.defaultScopesFor,
    ),
}) satisfies And

export type Or = FilterGenerator<
    <F1 extends FilterBase, F2 extends FilterBase>(
        f1: F1,
        f2: F2,
    ) => Filter<UnionFilterInfo<FilterInfoOf<F1>, FilterInfoOf<F2>>>
>

const orKeyGenerator = ([a, b]: Parameters<Or>) =>
    `revenge.or(${a.key},${b.key})`

const orScopesGenerator = ([a, b]: Parameters<Or>) => a.scopes | b.scopes

const directOr = createFilterGenerator(
    ([a, b], id, exports, initialized) =>
        a(id, exports, initialized) || b(id, exports, initialized),
    orKeyGenerator,
    orScopesGenerator,
) as Or

const prefilteredOr = createFilterGenerator(
    ([filter, prefilter], id, exports, initialized) => {
        // TODO(PalmDevs): Potential optimization: Add prefilter cache here too?
        if (initialized)
            return filter(id, exports, true) || prefilter(id, exports, true)
        return prefilter(id, undefined, false)
    },
    orKeyGenerator,
    orScopesGenerator,
) as Or

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
export const or = Object.assign(compositeHandler<Or>(directOr, prefilteredOr), {
    keyFor: compositeArrayHandler(directOr.keyFor, prefilteredOr.keyFor),
    defaultScopesFor: compositeArrayHandler(
        directOr.defaultScopesFor,
        prefilteredOr.defaultScopesFor,
    ),
}) satisfies Or
