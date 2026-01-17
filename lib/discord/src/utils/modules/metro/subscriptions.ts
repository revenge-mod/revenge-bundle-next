import { sImportedPath } from '../../../patches/import-tracker'
import type { ModuleFinishedImportingCallback } from '../../../patches/import-tracker'

/**
 * Registers a callback to be called when a module with a specific import path is initialized.
 *
 * @see {@link initializedModuleHasBadExports} to avoid bad module exports.
 *
 * @param callback The callback to be called.
 * @returns A function that unregisters the callback.
 */
export function onModuleFinishedImporting(
    callback: ModuleFinishedImportingCallback,
) {
    sImportedPath.add(callback)
    return () => {
        sImportedPath.delete(callback)
    }
}
