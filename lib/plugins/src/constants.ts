import { callNativeMethodSync } from '@revenge-mod/modules/native'

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

const { storageRootPath } = callNativeMethodSync(
    'revenge.plugins.getConstants',
    [],
)

/**
 * Per-plugin storage directory, relative to app data directory.
 */
// TODO: is it best to share this with the native side, or should we let native side be the sole source of truth?
export const pluginStorageDirFor = (id: string) => `${storageRootPath}/${id}`
