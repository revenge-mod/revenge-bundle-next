import { DispatcherModuleId } from '@revenge-mod/discord/common/flux'
import { ImportTrackerModuleId } from '@revenge-mod/discord/common/import-tracker'
import {
    lookupModule,
    lookupModules,
    waitForModules,
} from '@revenge-mod/modules/finders'
import {
    createFilterGenerator,
    withDependencies,
} from '@revenge-mod/modules/finders/filters'
import { isModuleExportBad } from '@revenge-mod/modules/metro/utils'
import { asap, noop } from '@revenge-mod/utils/callback'
import {
    cache,
    cacheFilterResultForId,
    Uncached,
} from '../../../modules/src/caches'
import { FilterResultFlags } from '../../../modules/src/finders/_internal'
import { FilterScopes } from '../../../modules/src/finders/filters/constants'
import type {
    Filter,
    FilterGenerator,
} from '@revenge-mod/modules/finders/filters'
import type { DiscordModules } from '../types'

/// STORES

const _stores: Record<string, DiscordModules.Flux.Store> = {}

/**
 * A proxy that allows you to access Flux stores by their name, including uninitialized stores.
 *
 * Use `Reflect.ownKeys()` on this proxy to get a list of all initialized stores.
 *
 * @see {@link getStore} for a way to get stores lazily.
 */
export const Stores = new Proxy(_stores, {
    ownKeys: target => Reflect.ownKeys(target),
    get: (target, prop: string) =>
        target[prop] ?? lookupModule(withStoreName(prop))[0],
})

/**
 * Gets a Flux store by its name, and calls the provided callback with the store.
 *
 * @param name The name of the store to get.
 * @param callback A callback that will be called with the store once it is found.
 * @returns A function that can be used to cancel the wait for the store.
 */
export function getStore<T>(
    name: string,
    callback: (store: DiscordModules.Flux.Store<T>) => void,
) {
    const store = _stores[name]
    if (store) {
        callback(store as DiscordModules.Flux.Store<T>)
        return noop
    }

    return waitForModules(withStoreName<T>(name), callback, { cached: true })
}

/// STORE FILTERING

const { last, includes } = withDependencies

// The import tracker is checked first, as it is far cheaper than resolving includes
const withFluxStoreDeps = withDependencies(last([ImportTrackerModuleId])).and(
    withDependencies(includes([DispatcherModuleId])),
)

export type WithStore = FilterGenerator<
    <T>() => Filter<{
        Result: DiscordModules.Flux.Store<T>
        Scopes: [
            typeof FilterScopes.Uninitialized,
            typeof FilterScopes.Initialized,
        ]
    }>
>

/**
 * A dynamic filter that matches all Flux stores.
 */
export const withStore = createFilterGenerator(
    (_, id, exports, initialized) => {
        if (initialized)
            return (
                !isModuleExportBad(exports) && Boolean(exports._dispatchToken)
            )

        return withFluxStoreDeps(id, undefined, false)
    },
    () => 'revenge.discord.store',
    FilterScopes.Uninitialized | FilterScopes.Initialized,
) as WithStore

export type WithStoreName = FilterGenerator<
    <T>(name: string) => Filter<{
        Result: DiscordModules.Flux.Store<T>
        Scopes: [typeof FilterScopes.Initialized]
    }>
>

/**
 * A with-exports filter that matches a Flux store by its name.
 */
export const withStoreName = createFilterGenerator(
    ([name], _, exports) => {
        if (isModuleExportBad(exports)) return false

        const getNameMethod = exports.getName

        return (
            typeof getNameMethod === 'function' &&
            getNameMethod.length === 0 &&
            // Needs to be bound to exports since it's a class
            exports.getName() === name
        )
    },
    ([name]) => `revenge.discord.storeName(${name})`,
    // Uninitialized to make sure cached results resolve immediately
    FilterScopes.Initialized | FilterScopes.Uninitialized,
) as WithStoreName

/// STORE CACHING

waitForModules(withStore(), (store, id) => {
    const name = store.getName()
    // Cache stores
    cacheFilterResultForId(
        withStoreName.keyFor([name]),
        id,
        FilterResultFlags.Default,
    )
    Stores[name] = store
})

if (cache === Uncached)
    asap(() => {
        const lookup = lookupModules(withStore())

        // Initialize all stores
        for (const _ of lookup);
    })
