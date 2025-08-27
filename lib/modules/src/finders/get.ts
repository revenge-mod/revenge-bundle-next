import { asap, noop } from '@revenge-mod/utils/callback'
import {
    lookupModule,
    lookupModules,
    lookupModuleWithImportedPath,
} from './lookup'
import { waitForModules, waitForModuleWithImportedPath } from './wait'
import type { If } from '@revenge-mod/utils/types'
import type { MaybeDefaultExportMatched, Metro } from '../types'
import type { RunFilterReturnExportsOptions } from './_internal'
import type { Filter, FilterResult } from './filters'
import type { LookupModulesOptions } from './lookup'
import type { WaitForModulesOptions } from './wait'

export type GetModulesOptions<
    ReturnNamespace extends boolean = boolean,
    Uninitialized extends boolean = boolean,
    All extends boolean = boolean,
> = WaitForModulesOptions<ReturnNamespace> &
    LookupModulesOptions<ReturnNamespace, Uninitialized, All, true> & {
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
> = O extends RunFilterReturnExportsOptions<true>
    ? MaybeDefaultExportMatched<FilterResult<F>>
    : FilterResult<F>

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

export function getModules<
    F extends Filter,
    const O extends F extends Filter<any, infer RE>
        ? If<RE, GetModulesOptions<boolean, boolean, false>, GetModulesOptions>
        : never,
>(
    filter: F,
    callback: GetModulesCallback<FilterResult<F>>,
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

/**
 * Get a single module by its imported path.
 * Once a module is found, unsubscription happens automatically, since imported paths are unique.
 *
 * @param path The path to find the module by.
 * @param options The options to use for the find.
 * @returns A promise that resolves to the module's exports or rejects if the find is aborted before the module is found.
 *
 * @example
 * ```ts
 * getModuleWithImportedPath('modules/main_tabs_v2/native/settings/SettingsConstants.tsx', SettingsConstants => {
 *   console.log('Settings page opened') // Logs once the module is initialized
 * })
 * ```
 */
export function getModuleWithImportedPath<T>(
    path: string,
    callback: GetModulesCallback<T>,
): GetModulesUnsubscribeFunction {
    const [exports, id] = lookupModuleWithImportedPath(path)
    if (id !== undefined) {
        callback(exports, id)
        return noop
    }

    const unsub = waitForModuleWithImportedPath(path, (exports, id) => {
        unsub()
        callback(exports, id)
    })

    return unsub
}
