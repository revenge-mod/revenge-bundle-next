import { getBlacklistedModules } from '../../modules/src/caches'
import {
    mDeps,
    mInitialized,
    mInitializingId,
    mList,
    mUninitialized,
} from '../../modules/src/metro/patches'
import {
    HasError,
    HasImportedAll,
    HasImportedDefault,
    Initialized,
    Initializing,
    mErrorChain,
} from '../../modules/src/metro/runtime'
import { patchedFunctionProxyStates } from '../../patcher/src/_internal'
import { PluginStatus } from '../../plugins/src/_internal/constants'
import {
    getInternalPluginMeta,
    InternalPluginFlags,
    PluginFlags,
    pList,
} from '../../plugins/src/_internal/index'
import { formatVersion } from '../../plugins/src/utils'
import type { FilterScopes } from '../../modules/src/finders/filters'
import type { Metro } from '../../modules/src/types'
import type { PatchedFunctionProxyState } from '../../patcher/src/_internal'
import type { UnknownFunction } from '../../patcher/src/types'
import type { PluginSystemErrorPayload } from '../../plugins/src/_internal/index'

/** The module definition flag bits, so a raw `flags` number can be read. */
export const ModuleFlags = {
    Initialized,
    Initializing,
    HasError,
    HasImportedDefault,
    HasImportedAll,
}

export interface ModuleDescription {
    id: Metro.ModuleID
    /** Blacklisted modules are skipped by finders unless explicitly requested via {@link FilterScopes.All}. */
    blacklisted: boolean
    dependencies: Metro.DependencyMap | undefined
    error: unknown
    exports: Metro.ModuleExports | undefined
    /** The raw flags, in case you want to decode them yourself. */
    flags: number
    flagsDecoded: string
}

/** Describes a module the way the runtime sees it. */
export function describeModule(id: Metro.ModuleID): ModuleDescription {
    const mod = mList.get(id)
    if (!mod)
        throw new Error(
            `Module ${id} is not registered. It may be in an unloaded segment.`,
        )
    const flags = mod?.flags ?? 0

    return {
        id,
        blacklisted:
            mod !== undefined &&
            !mUninitialized.has(id) &&
            !mInitialized.has(id),
        dependencies: mDeps.get(id),
        error: mod?.error,
        exports: mod?.module?.exports,
        flagsDecoded: bitFieldToString(ModuleFlags, flags),
        flags,
    }
}

export interface MetroSnapshot {
    total: number
    initialized: number
    uninitialized: number
    blacklisted: number
    /** The module currently running its factory, if any. */
    initializingId: Metro.ModuleID | undefined
    /** Every module that threw while initializing, in the order it happened. */
    errors: [Metro.ModuleID, unknown][]
}

/** A quick look at the state of the module table. */
export function describeMetro(): MetroSnapshot {
    return {
        total: mList.size,
        initialized: mInitialized.size,
        uninitialized: mUninitialized.size,
        blacklisted: getBlacklistedModules().length,
        initializingId: mInitializingId,
        errors: mErrorChain,
    }
}

export interface PluginDescription {
    id: string
    name: string
    version: string
    status: string
    flags: string
    iflags: string
    api: boolean
    dependencies: string[]
    errors: readonly unknown[]
    /** Errors reported by the plugin's native side. */
    nativeErrors: readonly PluginSystemErrorPayload[]
}

/** Describes a registered plugin with its flags and status decoded. */
export function describePlugin(id: string): PluginDescription | undefined {
    const plugin = pList.get(id)
    if (!plugin) return undefined

    const { manifest } = plugin
    const meta = getInternalPluginMeta(plugin)
    const { flags, iflags } = meta

    return {
        id: manifest.id,
        name: manifest.name,
        version: formatVersion(manifest.version),
        status: bitFieldToString(PluginStatus, meta.status),
        flags: bitFieldToString(PluginFlags, flags),
        iflags: bitFieldToString(InternalPluginFlags, iflags),
        api: Boolean(iflags & InternalPluginFlags.API),
        dependencies: Object.keys(manifest.dependencies ?? {}),
        errors: plugin.errors,
        nativeErrors: meta.nativeErrors,
    }
}

/** Describes every registered plugin. */
export function describePlugins(): PluginDescription[] {
    const descriptions: PluginDescription[] = []
    for (const id of pList.keys()) descriptions.push(describePlugin(id)!)
    return descriptions
}

/** Returns the patch state of a function, if it is patched. */
export function getPatchState(
    fn: UnknownFunction,
): PatchedFunctionProxyState | undefined {
    return patchedFunctionProxyStates.get(fn)
}

export function bitFieldToString(
    map: Record<string, number>,
    bitField: number,
) {
    const known =
        Object.entries(map)
            .filter(([, value]) => bitField & value)
            .map(([key]) => key)
            .join(', ') || '-'

    const unknown = bitField & ~Object.values(map).reduce((a, b) => a | b, 0)
    return unknown ? `${known} + 0b${unknown.toString(2)}` : known
}
