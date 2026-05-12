/**
 * A minimal implementation of Metro's runtime with little overhead.
 * Making initialization faster and use less resources.
 *
 * Also avoids cloning exports, allowing for patches to be applied directly without checking for clones.
 */

import { loadModuleFromSegment, mList } from './patches'
import { executeInitializeSubscriptions } from './subscriptions/_internal'
import type { Metro } from '../types'

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
    if (flags & HasError) throw mod.error

    mod.flags |= Initializing

    moduleObject = mod.module = {
        exports: {},
        id: moduleId,
    }

    try {
        const { factory } = mod
        mod.factory = undefined

        factory!()

        mod.flags = (flags & NotInitializedOrInitializingMask) | Initialized

        executeInitializeSubscriptions(moduleId, moduleObject.exports)

        return moduleObject.exports
    } catch (e) {
        mod.flags = (flags & NotInitializedOrInitializingMask) | HasError
        mod.error = e
        mod.module = undefined

        // @ts-expect-error: Not documented, but used by React Native
        if (global.ErrorUtils) global.ErrorUtils.reportFatalError(e)
        else throw e
    }
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
