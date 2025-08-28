export const FilterFlag = {
    /**
     * This filter works with and without module exports.
     * Allowing for both initialized and uninitialized modules to be matched.
     */
    Dynamic: 0,
    /**
     * This filter requires module exports to work.
     * Only initialized modules will be matched.
     */
    RequiresExports: 1,
} as const

/**
 * @see {@link FilterFlag}
 */
export type FilterFlag = number
