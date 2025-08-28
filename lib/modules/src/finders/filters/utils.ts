import { and, or } from './composite'
import type { Metro } from '@revenge-mod/modules/types'
import type { If, LogicalAnd } from '@revenge-mod/utils/types'
import type { FilterFlag } from './constants'

export type FilterResult<F> = F extends Filter<infer R, boolean>
    ? R
    : F extends FilterBase<infer R>
      ? R
      : never

export type FilterRequiresExports<F> = F extends Filter<any, infer RE>
    ? RE
    : F extends FilterBase<any, infer RE>
      ? RE
      : never

export interface FilterBase<
    _Result = any,
    RequiresExports extends boolean = boolean,
> {
    (
        ...args: If<
            RequiresExports,
            [id: Metro.ModuleID, exports: Metro.ModuleExports],
            [id: Metro.ModuleID, exports?: never]
        >
    ): boolean
    key: string
    flags: If<
        RequiresExports,
        (typeof FilterFlag)['RequiresExports'],
        FilterFlag
    >
}

export type Filter<
    Result = any,
    RequiresExports extends boolean = boolean,
> = FilterHelpers & FilterBase<Result, RequiresExports>

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
    and<T extends FilterBase, F extends FilterBase>(
        this: T,
        filter: F,
    ): Filter<
        FilterResult<T> & FilterResult<F>,
        LogicalAnd<FilterRequiresExports<T>, FilterRequiresExports<F>>
    >
    /**
     * Combines this filter with another filter, returning a new filter that matches if **either** filter matches.
     *
     * Note that exportsless filters must come first to avoid gotchas with uninitialized modules.
     *
     * @param filter The filter to combine with.
     */
    or<T extends FilterBase, F extends FilterBase>(
        this: T,
        filter: F,
    ): Filter<
        FilterResult<T> | FilterResult<F>,
        LogicalAnd<FilterRequiresExports<T>, FilterRequiresExports<F>>
    >
}

export type FilterGenerator<G extends (...args: any[]) => Filter> = G & {
    keyFor(args: Parameters<G>): string
    flagsFor(args: Parameters<G>): FilterFlag
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
 * @param flagFor The function that generates the flags for the filter, or a static flag.
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
    flagFor: ((args: A) => FilterFlag) | FilterFlag,
): FilterGenerator<(...args: A) => Filter<any, true>>

export function createFilterGenerator<A extends any[]>(
    filter: (args: A, id: Metro.ModuleID) => boolean,
    keyFor: (args: A) => string,
    flagFor: ((args: A) => FilterFlag) | FilterFlag,
): FilterGenerator<(...args: A) => Filter<any, false>>

export function createFilterGenerator<A extends any[]>(
    filter: (
        args: A,
        id: Metro.ModuleID,
        exports?: Metro.ModuleExports,
    ) => boolean,
    keyFor: (args: A) => string,
    flagFor: ((args: A) => FilterFlag) | FilterFlag,
): FilterGenerator<(...args: A) => Filter> {
    type GeneratorType = ReturnType<typeof createFilterGenerator<A>>

    const isFlagsStatic = typeof flagFor === 'number'

    const generator: GeneratorType = (...args: A) => {
        const filter_ = ((id: Metro.ModuleID, exports?: Metro.ModuleExports) =>
            filter(args, id, exports)) as ReturnType<GeneratorType>

        filter_.key = keyFor(args)
        filter_.flags = isFlagsStatic ? flagFor : flagFor(args)
        return Object.setPrototypeOf(filter_, Helpers)
    }

    generator.flagsFor = isFlagsStatic
        ? () => flagFor
        : (args: A) => flagFor(args)

    generator.keyFor = keyFor

    return generator
}
