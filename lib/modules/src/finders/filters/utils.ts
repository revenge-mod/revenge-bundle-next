import { withProps } from '.'
import { and, or } from './composite'
import { FilterScopes } from './constants'
import type { Metro } from '@revenge-mod/modules/types'
import type { If, LogicalAnd } from '@revenge-mod/utils/types'
import type {
    DefaultFilterInfo,
    FilterFlag,
    FilterInfo,
    FilterScope,
    FilterScopes as FilterScopesObject,
    FilterScopeValue,
} from './constants'

export type FilterResult<F> = F extends Filter<infer I> ? I['Result'] : never

export type FilterRequiresExports<F> = F extends Filter<infer I>
    ? I['RequiresExports']
    : never

export type FilterInfoOf<F> = F extends Filter<infer I> ? I : FilterInfo

export interface FilterBase<Info extends FilterInfo = DefaultFilterInfo> {
    (
        ...args: If<
            Info['RequiresExports'],
            [id: Metro.ModuleID, exports: Metro.ModuleExports],
            [id: Metro.ModuleID, exports?: never]
        >
    ): boolean
    key: string
    flags: If<
        Info['RequiresExports'],
        (typeof FilterFlag)['RequiresExports'],
        FilterFlag
    >
    scopes: FilterScopeValue
}

export type Filter<Info extends FilterInfo = DefaultFilterInfo> =
    FilterHelpers<Info> & FilterBase<Info>

export type MergeFilterInfo<I1 extends FilterInfo, I2 extends FilterInfo> = {
    Result: I1['Result'] & I2['Result']
    RequiresExports: LogicalAnd<I1['RequiresExports'], I2['RequiresExports']>
    Scopes: [...I1['Scopes'], ...I2['Scopes']]
}

export type UnionFilterInfo<I1 extends FilterInfo, I2 extends FilterInfo> = {
    Result: I1['Result'] | I2['Result']
    RequiresExports: LogicalAnd<I1['RequiresExports'], I2['RequiresExports']>
    Scopes: [...I1['Scopes'], ...I2['Scopes']]
}

export interface FilterHelpers<Info extends FilterInfo = DefaultFilterInfo> {
    /**
     * Manually the key for this filter.
     *
     * **Don't use this unless you know what you're doing.** Only API exports should be using this.
     *
     * @param key The key to set for this filter.
     */
    keyAs<T extends FilterBase<any>>(this: T, key: string): T
    /**
     * Combines this filter with another filter, returning a new filter that matches if **both** filters match.
     *
     * @param filter The filter to combine with.
     */
    and<T extends FilterBase<any>, F extends FilterBase<any>>(
        this: T,
        filter: F,
    ): Filter<MergeFilterInfo<Info, FilterInfoOf<F>>>
    /**
     * Combines this filter with another filter, returning a new filter that matches if **either** filter matches.
     *
     * @param filter The filter to combine with.
     */
    or<T extends Filter<Info>, F extends FilterBase<any>>(
        this: T,
        filter: F,
    ): Filter<UnionFilterInfo<Info, FilterInfoOf<F>>>
    /**
     * Creates a new instance of this filter.
     */
    // biome-ignore format: Preserve special property name syntax for 'new' keyword
    'new'(this: Filter<Info>): Filter<Info>
    /**
     * Scopes this filter to match specific modules.
     *
     * @param scopes The scopes of modules to match.
     */
    scope<T extends Filter<Info>, const S extends FilterScope[]>(
        this: T,
        ...scopes: If<
            Info['RequiresExports'],
            [typeof FilterScopesObject.Initialized],
            S
        >
    ): Filter<
        Info & {
            Scopes: If<
                Info['RequiresExports'],
                [typeof FilterScopesObject.Initialized],
                S
            >
        }
    >
}

export type FilterGenerator<G extends (...args: any[]) => Filter> = G & {
    keyFor(args: Parameters<G>): string
    flagsFor(args: Parameters<G>): FilterFlag
    defaultScopesFor(args: Parameters<G>): FilterScopeValue
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
        new() {
            const newFilter = ((
                id: Metro.ModuleID,
                exports?: Metro.ModuleExports,
            ) => this(id, exports)) as typeof this

            Object.assign(newFilter, this)

            return Object.setPrototypeOf(newFilter, Helpers)
        },
        scope(...scopes) {
            const filter = this.new()
            filter.scopes = 0
            for (const scope of scopes) filter.scopes |= scope
            return filter
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
 * @param defaultScopesFor The function that generates the default scopes for the filter, or static scopes. Defaults to {@link FilterScopes.Initialized}.
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
    defaultScopesFor?: ((args: A) => FilterScopeValue) | FilterScopeValue,
): FilterGenerator<(...args: A) => Filter>

export function createFilterGenerator<A extends any[]>(
    filter: (args: A, id: Metro.ModuleID) => boolean,
    keyFor: (args: A) => string,
    flagFor: ((args: A) => FilterFlag) | FilterFlag,
    defaultScopesFor?: ((args: A) => FilterScopeValue) | FilterScopeValue,
): FilterGenerator<(...args: A) => Filter>

export function createFilterGenerator<A extends any[]>(
    filter: (
        args: A,
        id: Metro.ModuleID,
        exports?: Metro.ModuleExports,
    ) => boolean,
    keyFor: (args: A) => string,
    flagFor: ((args: A) => FilterFlag) | FilterFlag,
    defaultScopesFor?: ((args: A) => FilterScopeValue) | FilterScopeValue,
): FilterGenerator<(...args: A) => Filter> {
    type GeneratorType = ReturnType<typeof createFilterGenerator<A>>

    const isFlagsStatic = typeof flagFor === 'number'

    const defaultScopes = defaultScopesFor ?? FilterScopes.Initialized
    const isDefaultScopesStatic = typeof defaultScopes === 'number'

    const generator: GeneratorType = (...args: A) => {
        const filter_ = ((id: Metro.ModuleID, exports?: Metro.ModuleExports) =>
            filter(args, id, exports)) as ReturnType<GeneratorType>

        filter_.key = keyFor(args)
        filter_.flags = isFlagsStatic ? flagFor : flagFor(args)
        filter_.scopes = isDefaultScopesStatic
            ? defaultScopes
            : defaultScopes(args)
        return Object.setPrototypeOf(filter_, Helpers)
    }

    generator.flagsFor = isFlagsStatic
        ? () => flagFor
        : (args: A) => flagFor(args)

    generator.defaultScopesFor = isDefaultScopesStatic
        ? () => defaultScopes
        : defaultScopes

    generator.keyFor = keyFor

    return generator
}
