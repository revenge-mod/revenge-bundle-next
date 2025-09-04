import { noop } from '@revenge-mod/utils/callback'
import { getFilterMatches } from '../caches'
import { mInitialized } from '../metro/patches'
import {
    onAnyModuleInitialized,
    onModuleFinishedImporting,
    onModuleInitialized,
} from '../metro/subscriptions'
import {
    exportsFromFilterResultFlag,
    FilterResultFlagToHumanReadable,
    runFilter,
} from './_internal'
import type { MaybeDefaultExportMatched, Metro } from '../types'
import type {
    FilterResultFlag,
    RunFilterReturnExportsOptions,
} from './_internal'
import type { Filter, FilterResult } from './filters'

export interface BaseWaitForModulesOptions<All extends boolean = boolean> {
    /**
     * Whether to include all modules, including blacklisted ones.
     *
     * @default false
     */
    all?: All
}

export type WaitForModulesUnsubscribeFunction = () => void

export type WaitForModulesCallback<T> = (exports: T, id: Metro.ModuleID) => any

export type WaitForModulesOptions<
    ReturnNamespace extends boolean = boolean,
    All extends boolean = boolean,
> = RunFilterReturnExportsOptions<ReturnNamespace> &
    BaseWaitForModulesOptions<All> & {
        /**
         * Use cached results **only** (if possible).
         * If there is no cache result, this works as if you did not pass this option at all.
         *
         * By default, waits cache results but does not use them, because new modules may still be found.
         * Use this option as an optimization if you are sure that you don't need to find new modules once results are cached.
         *
         * @default false
         */
        cached?: boolean
    }

export type WaitForModulesResult<
    F extends Filter,
    O extends WaitForModulesOptions,
> = O extends RunFilterReturnExportsOptions<true>
    ? MaybeDefaultExportMatched<FilterResult<F>>
    : FilterResult<F>

/**
 * Wait for modules to initialize. **Callback won't be called if the module is already initialized!**
 *
 * @param filter The filter to use.
 * @param callback The callback to call when matching modules are initialized.
 * @param options The options to use for the wait.
 * @returns A function to unsubscribe.
 *
 * @example
 * ```ts
 * const unsub = waitForModules(
 *   withName<typeof import('@shopify/flash-list')>('FlashList'),
 *   // (exports: typeof import('@shopify/flash-list'), id: Metro.ModuleID) => any
 *   (exports, id) => {
 *     unsub()
 *     // Do something with the module...
 *   }
 * )
 * ```
 */
export function waitForModules<F extends Filter>(
    filter: F,
    callback: WaitForModulesCallback<WaitForModulesResult<F, object>>,
): WaitForModulesUnsubscribeFunction

export function waitForModules<
    F extends O extends WaitForModulesOptions<boolean, true>
        ? Filter<any, false>
        : Filter,
    O extends WaitForModulesOptions,
>(
    filter: F,
    callback: WaitForModulesCallback<WaitForModulesResult<F, O>>,
    options: O,
): WaitForModulesUnsubscribeFunction

export function waitForModules(
    filter: Filter,
    callback: WaitForModulesCallback<any>,
    options?: WaitForModulesOptions,
): WaitForModulesUnsubscribeFunction {
    if (options?.cached) {
        const reg = getFilterMatches(filter.key)
        if (reg === null) return noop

        if (reg) {
            if (__BUILD_FLAG_DEBUG_MODULE_WAITS__)
                nativeLoggingHook(
                    `\u001b[32mUsing cached results for wait: \u001b[33m${filter.key}\u001b[0m`,
                    1,
                )

            const runCachedCallback = (
                id: Metro.ModuleID,
                exports: Metro.ModuleExports,
            ) => {
                const flag = reg[id]

                if (__BUILD_FLAG_DEBUG_MODULE_WAITS__)
                    DEBUG_logWaitMatched(filter.key, id, flag, true)

                callback(
                    exportsFromFilterResultFlag(flag, exports, options),
                    id,
                )
            }

            const cleanups: Array<() => void> = []

            for (const sId of Object.keys(reg)) {
                const id = Number(sId)
                if (mInitialized.has(id)) continue

                cleanups.push(onModuleInitialized(id, runCachedCallback))
            }

            return () => {
                for (const cleanup of cleanups) cleanup()
            }
        }
    }

    if (__BUILD_FLAG_DEBUG_MODULE_WAITS__)
        nativeLoggingHook(
            `\u001b[94mWaiting for module matching: \u001b[93m${filter.key}\u001b[0m`,
            1,
        )

    return onAnyModuleInitialized(
        options?.all
            ? (id, exports) => {
                  const flag = runFilter(filter, id, exports, options)
                  if (flag) {
                      if (__BUILD_FLAG_DEBUG_MODULE_WAITS__)
                          DEBUG_logWaitMatched(filter.key, id, flag)

                      callback(
                          exportsFromFilterResultFlag(flag, exports, options),
                          id,
                      )
                  }
              }
            : (id, exports) => {
                  if (mInitialized.has(id)) {
                      const flag = runFilter(filter, id, exports, options)
                      if (flag) {
                          if (__BUILD_FLAG_DEBUG_MODULE_WAITS__)
                              DEBUG_logWaitMatched(filter.key, id, flag)

                          callback(
                              exportsFromFilterResultFlag(
                                  flag,
                                  exports,
                                  options,
                              ),
                              id,
                          )
                      }
                  }
              },
    )
}

/**
 * Wait for a module to initialize by its imported path. **Callback won't be called if the module is already initialized!**
 *
 * Once callback is called, the subscription will be removed automatically, because modules have unique imported paths.
 *
 * Think of it as if you are doing `import * as exports from path`, and you are also waiting for the app to initialize the module by itself.
 *
 * @param path The path to wait for.
 * @param callback The callback to call once the module is initialized.
 * @param options The options to use for the wait.
 * @returns A function to unsubscribe.
 *
 * @example
 * ```ts
 * waitForModuleWithImportedPath(
 *   'utils/PlatformUtils.tsx',
 *   (exports, id) => {
 *      // Do something with the module...
 *   }
 * )
 * ```
 */
export function waitForModuleWithImportedPath<T = any>(
    path: string,
    callback: WaitForModulesCallback<T>,
    options?: BaseWaitForModulesOptions,
): WaitForModulesUnsubscribeFunction {
    const unsub = onModuleFinishedImporting((id, cmpPath) => {
        if (path === cmpPath) {
            unsub()
            // Module is not fully initialized yet, so we need to wait for it
            onModuleInitialized(id, (id, exports) => {
                if (!options?.all || mInitialized.has(id)) callback(exports, id)
            })
        }
    })

    return unsub
}

/**
 * Logs to the developer that a module wait has matched.
 */
function DEBUG_logWaitMatched(
    key: string,
    id: Metro.ModuleID,
    flag: FilterResultFlag,
    cached?: boolean,
) {
    nativeLoggingHook(
        `\u001b[32mWait matched: \u001b[33m${key}\u001b[0m (matched ${id}, ${FilterResultFlagToHumanReadable[flag]}${cached ? ', \u001b[92mcached\u001b[0m' : ''})`,
        1,
    )
}
