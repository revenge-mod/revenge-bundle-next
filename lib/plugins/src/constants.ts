import { callPluginSystemMethodSync } from './_internal/native'

const { storageRootPath } = callPluginSystemMethodSync(
    'revenge.plugins.getConstants',
    [],
)

/** Absolute path to per-plugin storage directory. */
// TODO: is it best to dupe this logic with the native side???
export const pluginStorageDirFor = (id: string) => `${storageRootPath}/${id}`
