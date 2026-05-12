import { callBridgeMethodSync } from '@revenge-mod/modules/native'
import { getErrorStack } from '@revenge-mod/utils/error'
import { FullVersion } from '~constants'
import { cache, cacheBlacklistedModule, Uncached } from '../caches'
import {
    global,
    metroImportAll,
    metroImportDefault,
    metroRequire,
} from './runtime'
import { executeRequireSubscriptions } from './subscriptions/_internal'
import type { Metro, RevengeMetro } from '../types'

export let mInitializingId: Metro.ModuleID | undefined
/** Uninitialized IDs (not blacklisted) */
export const mUninitialized = new Set<Metro.ModuleID>()
/** Initialized IDs (not blacklisted) */
export const mInitialized = new Set<Metro.ModuleID>()

export const mDeps = new Map<Metro.ModuleID, Metro.DependencyMap>()

export const mList: RevengeMetro.ModuleList = new Map()

/**
 * Metro allows a bundle to be split into segments.
 *
 * A segment registers itself with `globalThis.__registerSegment(segmentId, moduleDefiner, moduleIds?)`:
 * - `moduleDefiner(id)` is a callback that triggers the (deferred) `__d(...)`
 *   call for module `id` belonging to this segment.
 * - `moduleIds` (optional, non-zero segments) is the list of module IDs that
 *   live in this segment, so the runtime can route requires to the right
 *   definer before the segment has actually defined them.
 *
 * When `metroRequire(id)` is called and `id` is not yet in `mList`, we look up
 * its segment, invoke that segment's definer (which is expected to call
 * `__d(...)` synchronously), and retry the lookup.
 *
 * @see https://github.com/facebook/metro/blob/6d63660/packages/metro-runtime/src/polyfills/require.js#L387
 */
export const mSegmentDefiners: Array<
    ((moduleId: Metro.ModuleID) => void) | undefined
> = []
export const mModuleIdToSegmentId = new Map<Metro.ModuleID, number>()

const registerSegment: Metro.RegisterSegmentFn = (
    segmentId,
    moduleDefiner,
    moduleIds,
) => {
    mSegmentDefiners[segmentId] = moduleDefiner
    if (moduleIds) {
        for (const id of moduleIds) {
            if (!mList.has(id) && !mModuleIdToSegmentId.has(id)) {
                mModuleIdToSegmentId.set(id, segmentId)
            }
        }
    }
}

/**
 * Resolve a module that is not yet present in `mList` by invoking its segment definer (if available)
 *
 * @returns The freshly-registered definition or `undefined`.
 */
export function loadModuleFromSegment(
    moduleId: Metro.ModuleID,
): RevengeMetro.ModuleDefinition | undefined {
    const segmentId = mModuleIdToSegmentId.get(moduleId) ?? 0
    const definer = mSegmentDefiners[segmentId]
    if (!definer) return undefined

    definer(moduleId)
    mModuleIdToSegmentId.delete(moduleId)

    return mList.get(moduleId)
}

const metroDefine = (
    factory: Metro.FactoryFn,
    id: Metro.ModuleID,
    dependencyMap: Metro.DependencyMap,
) => {
    mDeps.set(id, dependencyMap!)
    mUninitialized.add(id)

    const def: RevengeMetro.ModuleDefinition = {
        flags: 0,
        module: undefined,
        factory: () => {
            handleFactoryCall(factory, def.module!)
        },
        importedDefault: undefined,
        importedAll: undefined,
        error: undefined,
    }

    mList.set(id, def)
}

/**
 * Patching Metro's `__d` function to handle module definitions.
 * We roll our own implementation of Metro's core functions.
 *
 * Here's how Metro sets itself up:
 * 1. `__METRO_GLOBAL_PREFIX__ = ""`
 * 2. `${__METRO_GLOBAL_PREFIX__}__d = function define(...) {}`
 *    - Why don't we patch it here? Because we need to know the value of `__METRO_GLOBAL_PREFIX__` first
 *    - And since Revenge runs before everything else, we need to patch in the next steps:
 *      - We chose to patch it in 4. because we can access all the global functions at that point.
 * 3. `__r`, `__d`, `__c` is set
 * 4. `__registerSegment` is set
 *    - **PATCH**: Set `__d` to our own implementation.
 *    - **PATCH**: Set `__registerSegment` to our own implementation.
 *
 * 5. `clear()`
 *    - Metro clears the module list directly with `clear()` and not `__c()`.
 * 6. `metroRequire.importDefault = ...`, `metroRequire.importAll = ...`
 * 7. `global.__registerSegment = registerSegment`
 *    - **PATCH**: Replace `__registerSegment` with our own implementation so that
 *      segment-loaded modules become resolvable through our runtime.
 * 8. `__d(..., 0, [...])`
 *    - The first module is defined with ID 0, which is the index module.
 *    - **PATCH**: Override the `importDefault` and `importAll` functions in `__r`.
 * #. `__d` is called with subsequent module definitions
 * #. Segments are loaded and registered via `__registerSegment(...)`
 */
const defineKey = `${__METRO_GLOBAL_PREFIX__}__d` as const

// First __d call
globalThis[defineKey] = function define(origFactory, id, deps) {
    // Set own implementation of metroImportDefault and metroImportAll
    metroRequire.importDefault = metroImportDefault
    metroRequire.importAll = metroImportAll

    // Set to the actual custom implementation
    globalThis[defineKey] = metroDefine
    // Call the custom implementation
    metroDefine(origFactory, id, deps)
}

globalThis.__registerSegment = registerSegment

// Why don't we use all the arguments from Metro.FactoryFn?
// Because there's too many for Hermes to be able to use its dedicated CallN operation
// which only supports up to 4 arguments. (Call, Call1, Call2, Call3, Call4)
function handleFactoryCall(
    factory: Metro.FactoryFn,
    moduleObject: Metro.Module,
) {
    const prevId = mInitializingId
    mInitializingId = moduleObject.id!

    executeRequireSubscriptions(mInitializingId)

    try {
        factory(
            global,
            metroRequire,
            metroImportDefault,
            metroImportAll,
            moduleObject,
            moduleObject.exports,
            mDeps.get(mInitializingId)!,
        )

        const { exports } = moduleObject

        // If we don't have the ID in mUninitialized, it means the module is blacklisted
        if (mUninitialized.has(mInitializingId)) {
            // Blacklist exports that:
            // - are primitives (https://developer.mozilla.org/en-US/docs/Glossary/Primitive)
            // - are empty objects
            switch (typeof exports) {
                case 'function':
                    mInitialized.add(mInitializingId)
                    break

                // biome-ignore lint/suspicious/noFallthroughSwitchClause: Intentional
                case 'object': {
                    if (Object.keys(exports).length) {
                        mInitialized.add(mInitializingId)
                        break
                    }
                }

                default:
                    cacheBlacklistedModule(mInitializingId)
            }
        }
    } catch (e) {
        const msg = `Module ${mInitializingId} failed to initialize:\n\n${getErrorStack(e)}`

        if (__DEV__) {
            callBridgeMethodSync('revenge.alertError', [msg, FullVersion])
        } else {
            // So... it wasn't a great idea to throw, Discord has pushed a broken build that has some failing modules
            // Vanilla Metro would swallow the error and just return an empty object as the exports..., insanity
            // throw e
            moduleObject.exports = {}
            cacheBlacklistedModule(mInitializingId)
            nativeLoggingHook(msg, 2)
        }
    } finally {
        mUninitialized.delete(mInitializingId)
        mInitializingId = prevId
    }
}

/// MODULE PATCHES AND BLACKLISTS

// Restore blacklists
if (cache !== Uncached)
    for (const id of cache.blacklist) mUninitialized.delete(id)
