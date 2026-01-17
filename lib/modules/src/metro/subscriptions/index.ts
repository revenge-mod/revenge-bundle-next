import { sInitialize, sInitializeAny, sRequire, sRequireAny } from './_internal'
import type { Metro } from '../../types'

export type ModuleFirstRequiredCallback = (id: Metro.ModuleID) => void
export type ModuleInitializedCallback = (
    id: Metro.ModuleID,
    exports: Metro.ModuleExports,
) => void

/**
 * Registers a callback to be called when any module is initialized.
 *
 * This runs after the module factory has been executed, but before the module is considered initialized by Metro.
 * However, Revenge APIs will consider the module initialized at this point.
 *
 * @see {@link initializedModuleHasBadExports} to avoid bad module exports.
 *
 * @param callback The callback to be called.
 * @returns A function that unregisters the callback.
 */
export function onAnyModuleInitialized(callback: ModuleInitializedCallback) {
    sInitializeAny.add(callback)
    return () => {
        sInitializeAny.delete(callback)
    }
}

/**
 * Registers a callback to be called when a specific module is initialized.
 *
 * This runs after the module factory has been executed, but before the module is considered initialized by Metro.
 * However, Revenge APIs will consider the module initialized at this point.
 *
 * @see {@link initializedModuleHasBadExports} to avoid bad module exports.
 *
 * @param id The ID of the module.
 * @param callback The callback to be called.
 * @returns A function that unregisters the callback.
 */
export function onModuleInitialized(
    id: Metro.ModuleID,
    callback: ModuleInitializedCallback,
) {
    let set = sInitialize.get(id)
    if (!set) sInitialize.set(id, (set = new Set()))

    set.add(callback)
    return () => {
        set.delete(callback)
    }
}

/**
 * Registers a callback to be called when any module is being initialized.
 *
 * This runs before the module factory is executed.
 *
 * @see {@link initializedModuleHasBadExports} to avoid bad module exports.
 *
 * @param callback The callback to be called.
 * @returns A function that unregisters the callback.
 */
export function onAnyModuleFirstRequired(
    callback: ModuleFirstRequiredCallback,
) {
    sRequireAny.add(callback)
    return () => {
        sRequireAny.delete(callback)
    }
}

/**
 * Registers a callback to be called when a specific module is being initialized.
 *
 * This runs before the module factory is executed.
 *
 * @see {@link initializedModuleHasBadExports} to avoid bad module exports.
 *
 * @param id The ID of the module.
 * @param callback The callback to be called.
 * @returns A function that unregisters the callback.
 */
export function onModuleFirstRequired(
    id: Metro.ModuleID,
    callback: ModuleFirstRequiredCallback,
) {
    let set = sRequire.get(id)
    if (!set) sRequire.set(id, (set = new Set()))

    set.add(callback)
    return () => {
        set.delete(callback)
    }
}
