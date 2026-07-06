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

export const pluginStoragePathFor = (id: string) =>
    `revenge/plugins/storage/${id}/storage.json`
