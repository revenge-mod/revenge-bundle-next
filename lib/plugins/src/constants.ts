/**
 * The plugin flags.
 */
export const PluginFlags = {
    /**
     * The plugin is enabled.
     */
    Enabled: 1 << 0,
    /**
     * The plugin requires a reload to apply changes.
     */
    ReloadRequired: 1 << 1,
    /**
     * The plugin has errors.
     */
    Errored: 1 << 2,
    /**
     * The plugin was enabled after the app was started.
     * This is usually caused by a newly installed plugin, or a plugin that was re-enabled.
     */
    EnabledLate: 1 << 3,
}

/**
 * A bitmask of {@link PluginFlags} that are persisted to storage.
 */
export const PersistentPluginFlags = PluginFlags.Enabled

/**
 * The plugin status.
 */
export const PluginStatus = {
    PreIniting: 1 << 0,
    PreInited: 1 << 1,
    Initing: 1 << 2,
    Inited: 1 << 3,
    Starting: 1 << 4,
    Started: 1 << 5,
    Stopping: 1 << 6,
}

export const PluginsStorageDirectory = 'revenge/plugins/storage'
