import { namespaceOnly } from './filters'
import type { RunFilterOptions } from './_internal'
import type { Filter } from './filters'

// TODO: Remove this
/**
 * Migrates the deprecated {@link RunFilterOptions.skipDefault} option to {@link namespaceOnly}.
 * Returns the filter itself if there is nothing to migrate.
 *
 * Without this, cached results would be shared between lookups with and without the option, since they're keyed by the filter's key.
 */
export function migrateSkipDefaultOption<F extends Filter>(
    filter: F,
    options?: RunFilterOptions,
): F {
    if (options?.skipDefault) return namespaceOnly(filter) as unknown as F
    return filter
}
