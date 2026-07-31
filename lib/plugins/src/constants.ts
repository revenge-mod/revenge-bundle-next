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

const { storageRootPath, defaultsOnly } = callNativeMethodSync(
    'revenge.plugins.getConstants',
    [],
)

/**
 * Whether this boot ignores saved plugin states.
 *
 * Only essential and enabled-by-default plugins run. Saved states will come back on the next reload.
 */
export const isDefaultsOnlyBoot = defaultsOnly

/**
 * Absolute path to per-plugin storage directory.
 */
// TODO: is it best to dupe this logic with the native side???
export const pluginStorageDirFor = (id: string) => `${storageRootPath}/${id}`
