/**
 * Scopes to limit filters to certain module states.
 */
export const FilterScopes = {
    /**
     * Include all modules (both initialized and uninitialized, including blacklisted).
     * This overrides {@link FilterScopes.Uninitialized} and {@link FilterScopes.Initialized}.
     *
     * **Filter generators generally don't need this scope.**
     *
     * When combining multiple filters with composite filters, the {@link FilterScopes.All} scope doesn't set assumptions for the filter predicate.
     * It only decides which modules to run the predicate against.
     * **Filter generators must include {@link FilterScopes.Uninitialized} and/or {@link FilterScopes.Initialized} as well.**
     */
    All: 1,
    /**
     * Include uninitialized modules in the search. Implies the predicate can run without exports.
     */
    Uninitialized: 2,
    /**
     * Include initialized modules from the search.
     */
    Initialized: 4,
} as const

export type FilterScope = (typeof FilterScopes)[keyof typeof FilterScopes]

/**
 * @see {@link FilterScopes}
 */
export type FilterScopeValue = number

export interface FilterInfo {
    /**
     * The result type of the filter.
     */
    Result: any
    /**
     * Scopes the filter matches modules in.
     */
    Scopes: FilterScope[]
}

export interface DefaultFilterInfo extends FilterInfo {
    Result: any
    Scopes: FilterScope[]
}
