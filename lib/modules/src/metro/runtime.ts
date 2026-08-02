/**
 * A minimal implementation of Metro's runtime with little overhead.
 * Making initialization faster and use less resources.
 *
 * Also avoids cloning exports, allowing for patches to be applied directly without checking for clones.
 */

import { callNativeMethodSync } from '@revenge-mod/modules/native'
import { getErrorStack } from '@revenge-mod/utils/error'
import { FullVersion } from '~constants'
import { loadModuleFromSegment, mInitializingId, mList } from './patches'
import {
    executeInitializeSubscriptions,
    executeRequireSubscriptions,
} from './subscriptions/_internal'
import type { Metro } from '../types'

export const mErrorChain: Metro.ModuleID[] = []

export const Initialized = 1 << 0
const HasError = 1 << 1
const HasImportedDefault = 1 << 2
const HasImportedAll = 1 << 3
const Initializing = 1 << 4

const InitializedOrInitializing = Initialized | Initializing
const NotInitializedOrInitializingMask = ~InitializedOrInitializing

export const global = globalThis

export const metroRequire = (moduleId => {
    let mod = mList.get(moduleId)

    // Module isn't registered yet, maybe it's in another segment that hasn't been loaded yet.
    if (!mod) mod = loadModuleFromSegment(moduleId)
    if (!mod) throw new Error(`Requiring unknown module: ${moduleId}`)

    let { flags, module: moduleObject } = mod

    if (flags & InitializedOrInitializing) return moduleObject!.exports
    if (flags & HasError) {
        // Swallow the error and return an empty object, like what Metro does.
        // throw mod.error
        return moduleObject!.exports
    }

    mod.flags |= Initializing

    moduleObject = mod.module = {
        exports: {},
        id: moduleId,
    }

    executeRequireSubscriptions(moduleId)

    try {
        const { factory } = mod
        mod.factory = undefined

        factory!()
    } catch (e) {
        mod.flags = (flags & NotInitializedOrInitializingMask) | HasError
        mod.error = e

        const msg = `Module ${mInitializingId} failed to initialize:\n\n${getErrorStack(e)}`

        if (__DEV__) {
            callNativeMethodSync('revenge.alertError', [msg, FullVersion])
        } else {
            nativeLoggingHook(msg, 2)
        }

        // Some modifications can cause modules to fail by initializing them in the wrong order, we can't just blacklist them
        // cacheBlacklistedModule(mInitializingId)

        // So... it wasn't a great idea to throw, Discord has pushed a broken build that has some failing modules
        // Vanilla Metro would swallow the error and just return an empty object as the exports..., insanity

        // // @ts-expect-error: Not documented, but used by React Native
        // if (global.ErrorUtils) global.ErrorUtils.reportFatalError(e)
        // else throw e

        mErrorChain.push(moduleId)

        return (moduleObject.exports = {})
    }

    mod.flags = (flags & NotInitializedOrInitializingMask) | Initialized
    executeInitializeSubscriptions(moduleId, moduleObject.exports)

    return moduleObject.exports
}) as Metro.Require

global.__r = metroRequire

export const metroImportDefault: Metro.RequireFn = moduleId => {
    const exports = metroRequire(moduleId)

    // metroRequire may have lazily registered the module via a segment, so we
    // look up the definition after the require call.
    const mod = mList.get(moduleId)!
    if (mod.flags & HasImportedDefault) return mod.importedDefault

    mod.flags |= HasImportedDefault

    return (mod.importedDefault = exports?.__esModule
        ? exports.default
        : exports)
}

export const metroImportAll: Metro.RequireFn = moduleId => {
    const exports = metroRequire(moduleId)

    const mod = mList.get(moduleId)!
    if (mod.flags & HasImportedAll) return mod.importedAll

    // Our implementation doesn't match Metro's because we modify the exports directly instead of cloning
    // But this is why ours is superior, it allows patching the exports without needing to do it more than a single time
    if (!exports?.__esModule) exports.default = exports

    mod.flags |= HasImportedAll

    return (mod.importedAll = exports)
}
