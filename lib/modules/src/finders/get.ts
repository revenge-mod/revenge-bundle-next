import { asap, noop } from '@revenge-mod/utils/callback'
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
 *
 * This is a combination of {@link lookupModule} and {@link waitForModules}.
 *
 * @param filter The filter to use to find the module.
 * @param options The options to use for the find.
 * @returns A promise that resolves to the module's exports or rejects if the find is aborted before a module is found.
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

    if (max === 1) {
        const [exports, id] = lookupModule(filter, options!)
        if (id !== undefined) {
            // Run callback at the end of the event loop. This ensures that the noop is returned first.
            // Module is already initialized, there is likely no harm calling the callback late.
            asap(() => {
                callback(exports, id)
            })
            return noop
        }
    } else
        for (const [exports, id] of lookupModules(filter, options!)) {
            callback(exports, id)
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
