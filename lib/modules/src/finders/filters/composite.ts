import { FilterFlag } from './constants'
import { createFilterGenerator } from './utils'
import type { LogicalAnd } from '@revenge-mod/utils/types'
import type { Metro } from '#modules/src/types'
import type {
    Filter,
    FilterBase,
    FilterGenerator,
    FilterRequiresExports,
    FilterResult,
} from '.'

const compositeHandler = <G extends (a: FilterBase, b: FilterBase) => any>(
    sameHandler: G,
    dynamicHandler: G,
) =>
    ((a, b) =>
        a.flags === b.flags
            ? sameHandler(a, b)
            : a.flags === FilterFlag.RequiresExports
              ? dynamicHandler(a, b)
              : dynamicHandler(b, a)) as G

const compositeArrayHandler = <
    G extends (args: [a: FilterBase, b: FilterBase]) => any,
>(
    sameHandler: G,
    dynamicHandler: G,
) =>
    (([a, b]) =>
        a.flags === b.flags
            ? sameHandler([a, b])
            : a.flags === FilterFlag.RequiresExports
              ? dynamicHandler([a, b])
              : dynamicHandler([b, a])) as G

export type And = FilterGenerator<
    <F1 extends FilterBase, F2 extends FilterBase>(
        f1: F1,
        f2: F2,
    ) => Filter<
        FilterResult<F1> & FilterResult<F2>,
        LogicalAnd<FilterRequiresExports<F1>, FilterRequiresExports<F2>>
    >
>

const andKeyGenerator = ([a, b]: Parameters<And>) =>
    `revenge.and(${a.key},${b.key})`

const sameFlagsAnd = createFilterGenerator(
    ([a, b], id, exports) => a(id, exports) && b(id, exports),
    andKeyGenerator,
    ([a]) => a.flags,
) as And

const andFallbackCache = new WeakMap<FilterBase, Set<Metro.ModuleID>>()

const dynamicFlagsAnd = createFilterGenerator(
    ([filter, fallbackFilter], id, exports) => {
        if (exports) {
            if (filter(id, exports)) {
                // Avoid running the fallback filter if we already know the first one passed
                const cache = andFallbackCache.get(fallbackFilter)
                return (
                    // biome-ignore lint/complexity/useOptionalChain: Hot path should be optimized
                    (cache && cache.has(id)) || fallbackFilter(id, exports)
                )
            }

            return false
        }

        const result = fallbackFilter(id)
        if (result) {
            // Cache fallback hits to avoid calling the fallback filter again
            // Fallback filters are usually more expensive
            let set = andFallbackCache.get(fallbackFilter)
            if (!set) andFallbackCache.set(fallbackFilter, (set = new Set()))
            set.add(id)
        }
        return result
    },
    andKeyGenerator,
    FilterFlag.Dynamic,
) as And

/**
 * Combines two filters into one, returning true if **every** filter matches.
 *
 * If each filter has different flags,
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
export const and = Object.assign(
    compositeHandler(sameFlagsAnd, dynamicFlagsAnd),
    {
        keyFor: compositeArrayHandler(
            sameFlagsAnd.keyFor,
            dynamicFlagsAnd.keyFor,
        ),
        flagsFor: compositeArrayHandler(
            sameFlagsAnd.flagsFor,
            dynamicFlagsAnd.flagsFor,
        ),
    },
) satisfies And

export type Or = FilterGenerator<
    <F1 extends FilterBase, F2 extends FilterBase>(
        f1: F1,
        f2: F2,
    ) => Filter<
        FilterResult<F1> | FilterResult<F2>,
        LogicalAnd<FilterRequiresExports<F1>, FilterRequiresExports<F2>>
    >
>

const orKeyGenerator = ([a, b]: Parameters<Or>) =>
    `revenge.or(${a.key},${b.key})`

const sameFlagOr = createFilterGenerator(
    ([a, b], id, exports) => a(id, exports) || b(id, exports),
    orKeyGenerator,
    ([a]) => a.flags,
) as Or

const dynamicFlagOr = createFilterGenerator(
    ([filter, fallbackFilter], id, exports) => {
        // TODO(PalmDevs): Potential optimization: Add fallback cache here too?
        if (exports) return filter(id, exports) || fallbackFilter(id, exports)
        return fallbackFilter(id)
    },
    orKeyGenerator,
    FilterFlag.Dynamic,
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
export const or = Object.assign(
    compositeHandler<Or>(sameFlagOr, dynamicFlagOr),
    {
        keyFor: compositeArrayHandler(sameFlagOr.keyFor, dynamicFlagOr.keyFor),
        flagsFor: compositeArrayHandler(
            sameFlagOr.flagsFor,
            dynamicFlagOr.flagsFor,
        ),
    },
) satisfies Or
