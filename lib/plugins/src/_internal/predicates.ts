import { InternalPluginFlags, PluginFlags, PluginStatus } from './constants'
import { getInternalPluginMeta } from './registry'
import type { AnyPlugin, InternalPluginMeta } from './types'

const Flag = PluginFlags

export function isPluginEnabled(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return Boolean(meta.flags & Flag.Enabled)
}

export function isPluginStartedLate(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return Boolean(meta.flags & Flag.StartedLate)
}

export function isPluginEssential({ iflags }: InternalPluginMeta): boolean {
    return Boolean(iflags & InternalPluginFlags.Essential)
}

export function isPluginInternal({ iflags }: InternalPluginMeta): boolean {
    return Boolean(iflags & InternalPluginFlags.Internal)
}

export function isPluginErrored(plugin: AnyPlugin): boolean {
    return plugin.errors.length > 0
}

export function isPluginStarted(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return Boolean(meta.status & PluginStatus.Started)
}

export function isPluginStopped(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return meta.status === 0
}

export function isPluginPendingReload(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return Boolean(meta.flags & Flag.PendingReload)
}

export function isPluginPendingUpdate(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return Boolean(meta.flags & Flag.PendingUpdate)
}

/** @see {@link Flag.Failed} */
export function isPluginFailed(plugin: AnyPlugin): boolean {
    const meta = getInternalPluginMeta(plugin)
    return Boolean(meta.flags & Flag.Failed)
}

/** Validates if a plugin can start: enabled, not `PendingReload`, and not session-skipped. `PendingUpdate` does not block execution. */
export function requirePluginStartableState(plugin: AnyPlugin) {
    if (!isPluginEnabled(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" is not enabled`)

    if (isPluginPendingReload(plugin))
        throw new Error(
            `Plugin "${plugin.manifest.id}" requires a reload before it can be started again`,
        )

    if (isPluginFailed(plugin))
        throw new Error(
            `Plugin "${plugin.manifest.id}" failed to load this session (reload to retry)`,
        )
}

/** @see {@link requirePluginStartableState} */
export function isPluginStartable(plugin: AnyPlugin): boolean {
    try {
        requirePluginStartableState(plugin)
        return true
    } catch {
        return false
    }
}
