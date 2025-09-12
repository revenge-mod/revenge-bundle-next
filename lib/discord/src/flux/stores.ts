import {
    lookupModule,
    lookupModules,
    waitForModules,
} from '@revenge-mod/modules/finders'
import {
    createFilterGenerator,
    withName,
} from '@revenge-mod/modules/finders/filters'
import { getModuleDependencies } from '@revenge-mod/modules/metro/utils'
import { asap, noop } from '@revenge-mod/utils/callback'
import { cache, cacheFilterResultForId, Uncached } from '#modules/src/caches'
import { FilterResultFlags } from '#modules/src/finders/_internal'
import { FilterFlag } from '#modules/src/finders/filters/constants'
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
        target[prop] ??
        // @ts-expect-error: This always uses cache
        lookupModule(withStoreName(prop), { uninitialized: true })[0],
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

/* 
    Flux Store dependencies: [
        6, // _classCallCheck
        5, // _createClass
        14, // _possibleConstructorReturn
        16, // bound getPrototypeOf
        17, // _inherits
        (...), // (any amount of dependencies)
        2 // ImportTracker
    ]
*/

const [, _createClassModuleId] = lookupModule(withName('_createClass'))
const [, _classCallCheckModuleId] = lookupModule(withName('_classCallCheck'))
const [, _possibleConstructorReturnModuleId] = lookupModule(
    withName('_possibleConstructorReturn'),
)
const [, _bound_getPrototypeOfModuleId] = lookupModule(
    withName('bound getPrototypeOf'),
)
const [, _inheritsModuleId] = lookupModule(withName('_inherits'))

const FluxStoreLeadingDeps = [
    _classCallCheckModuleId,
    _createClassModuleId,
    _possibleConstructorReturnModuleId,
    _bound_getPrototypeOfModuleId,
    _inheritsModuleId,
]

export type WithStore = FilterGenerator<
    <T>() => Filter<DiscordModules.Flux.Store<T>, boolean>
>

/**
 * A dynamic filter that matches all Flux stores.
 */
export const withStore = createFilterGenerator(
    (_, id, exports) => {
        if (exports) return Boolean(exports._dispatchToken)
        else {
            const deps = getModuleDependencies(id)!
            if (deps.length < FluxStoreLeadingDeps.length) return false

            for (let i = 0; i < FluxStoreLeadingDeps.length; i++)
                if (deps[i] !== FluxStoreLeadingDeps[i]) return false

            return deps[deps.length - 1] === 2
        }
    },
    () => 'revenge.discord.store',
    FilterFlag.Dynamic,
) as WithStore

export type WithStoreName = FilterGenerator<
    <T>(name: string) => Filter<DiscordModules.Flux.Store<T>, true>
>

/**
 * A with-exports filter that matches a Flux store by its name.
 */
export const withStoreName = createFilterGenerator(
    ([name], _, exports) =>
        exports.getName?.length === 0 && exports.getName() === name,
    ([name]) => `revenge.discord.storeName(${name})`,
    FilterFlag.RequiresExports,
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
        const lookup = lookupModules(withStore(), {
            uninitialized: true,
        })

        while (lookup.next().done);
    })
