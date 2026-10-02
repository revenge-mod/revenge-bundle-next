import { storageRootPath } from './_internal/constants'

/** Absolute path to per-plugin storage directory. */
// TODO: is it best to dupe this logic with the native side???
export const pluginStorageDirFor = (id: string) => `${storageRootPath}/${id}`
