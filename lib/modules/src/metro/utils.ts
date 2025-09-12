import { isProxy } from '@revenge-mod/utils/proxy'
import { mDeps, mList } from './patches'
import { Initialized } from './runtime'
import type { Metro } from '../types'

/**
 * Returns the dependencies of a module.
 * @param id The module ID.
 * @returns The dependency map of the module, or `undefined` if the module does not exist.
 */
export function getModuleDependencies(
    id: Metro.ModuleID,
): Metro.DependencyMap | undefined {
    return mDeps.get(id)
}

/**
 * Returns whether a module is initialized.
 * @param id The module ID.
 * @returns Non-zero number if the module is initialized, `0` if it is not initialized or does not exist.
 */
export function isModuleInitialized(id: Metro.ModuleID): number | undefined {
    return mList.get(id)?.flags! & Initialized
}

/**
 * Returns the exports of an initialized module.
 *
 * @see {@link isModuleInitialized} to check if the module is initialized.
 *
 * @param id The module ID.
 * @returns The exports of the module, or `undefined` if the module is not initialized or does not exist.
 */
export function getInitializedModuleExports(
    id: Metro.ModuleID,
): Metro.ModuleExports | undefined {
    return mList.get(id)?.module?.exports
}

/**
 * Returns whether a particular module export is bad. This is used for filter functions to check whether an export is filterable.
 * @param exp The export to check.
 */
export function isModuleExportBad(
    exp: Metro.ModuleExports[PropertyKey],
): boolean {
    return (
        // Nullish?
        exp == null ||
        // Is it a proxy? (discord-intl has proxy exports)
        isProxy(exp) ||
        // Does it have some non-existent key? (Turbo modules)
        (typeof exp === 'object' && '\u0001' in exp)
    )
}
