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

/**
 * Whether a plugin has an implementation.
 *
 * @see {@link InternalPluginMeta.attached}
 */
export function isPluginAttached(plugin: AnyPlugin): boolean {
    return getInternalPluginMeta(plugin).attached
}

/**
 * Validates if a plugin can start:
 *
 * 1. Attached
 * 2. Enabled
 * 3. Not {@link Flag.PendingReload}. {@link Flag.PendingUpdate} does not block execution.
 * 4. Not session-skipped
 */
export function requirePluginStartableState(plugin: AnyPlugin) {
    if (!isPluginAttached(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" has no implementation`)

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
