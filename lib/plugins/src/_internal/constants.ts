import type { PluginVersion } from '../types'

/** Bundle version applied to internal plugins. */
export const InternalPluginVersion: PluginVersion = (() => {
    const [segments, label] = __BUILD_VERSION__.split('-')
    const nums = segments.split('.').map(Number)
    if (!label) return { nums }
    return { nums, label }
})()

/** Timeout in milliseconds before force-stopping a plugin. */
export const MaxStopWaitTime = 5000

export const PluginStatus = {
    PreIniting: 1 << 0,
    PreInited: 1 << 1,
    Initing: 1 << 2,
    Inited: 1 << 3,
    Starting: 1 << 4,
    Started: 1 << 5,
    Stopping: 1 << 6,
}

export const PluginFlags = {
    Enabled: 1 << 0,
    RequiredByUser: 1 << 1,
    PendingReload: 1 << 2,
    StartedLate: 1 << 3,
    /**
     * Newer version on disk while running version remains active until reload.
     *
     * JS-side flag.
     */
    PendingUpdate: 1 << 4,
    /**
     * Session-skipped plugins. Enabled, but will not execute during current session.
     * Caused by missing, unsatisfied, or failed dependencies, or bad manifest/code.
     *
     * JS-side flag.
     */
    Failed: 1 << 5,
}

/** Highest prepared lifecycle stage for plugin API. */
export const PluginApiLevel = {
    None: 0,
    PreInit: 1,
    Init: 2,
    Start: 3,
} as const

export const InternalPluginFlags = {
    Internal: 1 << 0,
    /** Plugin can't be stopped, disabled, or uninstalled. */
    Essential: 1 << 1,
    /**
     * Plugin implicitly decorates all plugins' APIs, except for other API plugins.
     * API plugins do not decorate each other unless explicitly declared as dependencies.
     */
    API: 1 << 2,
}
