import { onModuleInitialized } from '@revenge-mod/modules/metro/subscriptions'
import { isModuleInitialized } from '@revenge-mod/modules/metro/utils'
import { asap, noop } from '@revenge-mod/utils/callback'
import { FilterScopes } from './filters'
import { lookupModule, lookupModules } from './lookup'
import { waitForModules } from './wait'
import type { Metro } from '../types'
import type { Filter, FilterResult } from './filters'
import type { LookupModulesOptions } from './lookup'
import type { WaitForModulesOptions, WaitForModulesResult } from './wait'

export type GetModulesOptions<ReturnNamespace extends boolean = boolean> =
    WaitForModulesOptions<ReturnNamespace> &
        LookupModulesOptions<ReturnNamespace, true> & {
            /**
             * The maximum number of modules to get.
             *
             * @default 1
             */
            max?: number
        }

export type GetModulesResult<
    F extends Filter,
    O extends GetModulesOptions,
> = WaitForModulesResult<F, O>

export type GetModulesCallback<T> = (exports: T, id: Metro.ModuleID) => any

export type GetModulesUnsubscribeFunction = () => void

/**
 * Get modules matching the filter.
 * If the matching modules are already initialized, the callback will be called immediately.
 * Otherwise, it will be called when the matching modules are initialized.
 *
 * @param filter The filter to use to find the module.
 * @param options The options to use for the find.
 * @returns A function to unsubscribe.
 *
 * @example
 * ```ts
 * getModules(withProps<typeof import('react')>('createElement'), React => {
 *   // Immediately called because React is always initialized when plugins are loaded
 * })
 *
 * getModules(withProps<typeof import('@shopify/flash-list')>('FlashList'), FlashList => {
 *   // Called when the module is initialized
 * })
 *
 * // Get multiple modules matching the filter
 * getModules(withProps<ReactNative.AssetsRegistry>('registerAsset'), AssetsRegistry => {
 *   // Called 2 times, once for each module that matches the filter
 * }, { max: 2 })
 * ```
 */
export function getModules<F extends Filter>(
    filter: F,
    callback: GetModulesCallback<FilterResult<F>>,
): GetModulesUnsubscribeFunction

export function getModules<F extends Filter, const O extends GetModulesOptions>(
    filter: F,
    callback: GetModulesCallback<GetModulesResult<F, O>>,
    options: O,
): GetModulesUnsubscribeFunction

export function getModules(
    filter: Filter,
    callback: GetModulesCallback<any>,
    options?: GetModulesOptions,
) {
    let max = options?.max ?? 1

    // Only lookup modules that are already initialized
    const lookupFilter = filter.scope(FilterScopes.Initialized)

    function handleModule(
        exports: Metro.ModuleExports | undefined,
        id: Metro.ModuleID,
    ) {
        if (isModuleInitialized(id)) {
            // Run callback at the end of the event loop. This ensures that the noop is returned first.
            // Module is already initialized, there is likely no harm calling the callback late.
            asap(() => {
                callback(exports, id)
            })
        } else {
            // Module is not initialized, wait for it to be initialized before calling the callback.
            onModuleInitialized(id, (_, exports) => {
                callback(exports, id)
            })
        }
    }

    if (max === 1) {
        const [exports, id] = lookupModule(lookupFilter, options!)
        if (id !== undefined) {
            handleModule(exports, id)
            return noop
        }
    } else
        for (const [exports, id] of lookupModules(lookupFilter, options!)) {
            handleModule(exports, id)
            if (!--max) return noop
        }

    const unsub = waitForModules(
        filter,
        (exports, id) => {
            if (!--max) unsub()
            callback(exports, id)
        },
        options!,
    )

    return unsub
}
