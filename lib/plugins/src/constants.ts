import { distRootPath, storageRootPath } from './_internal/constants'

// TODO: is it best to dupe this logic with the native side???

/** Absolute path to per-plugin storage directory. */
export const pluginStorageDirFor = (id: string) => `${storageRootPath}/${id}`

/** Absolute path to an installed plugin's files. */
export const pluginDistDirFor = (id: string) => `${distRootPath}/${id}`
