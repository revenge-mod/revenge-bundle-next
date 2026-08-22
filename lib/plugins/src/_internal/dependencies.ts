import { getInternalPluginMeta, pList } from './registry'
import { isPluginEnabledInSavedStates } from './state'
import type { AnyPlugin } from './types'

/**
 * Resolves dependencies ordered before plugin.
 * Optional dependencies are included only when linked and satisfied.
 *
 * @param throwOnMissing Throws when required dependency is unregistered.
 */
export function getPluginDependencies(
    plugin: AnyPlugin,
    throwOnMissing = true,
): AnyPlugin[] {
    const { dependencies, id } = plugin.manifest
    const deps: AnyPlugin[] = []
    const { unsatisfiedOptionalDependencies } = getInternalPluginMeta(plugin)

    if (dependencies)
        for (const [depId, spec] of Object.entries(dependencies)) {
            const dep = pList.get(depId)

            if (dep) {
                if (
                    !spec.optional ||
                    (isPluginEnabledInSavedStates(dep) &&
                        !unsatisfiedOptionalDependencies.includes(depId))
                )
                    deps.push(dep)
            } else if (!spec.optional && throwOnMissing)
                throw new Error(
                    `Plugin "${id}" depends on unregistered plugin "${depId}"`,
                )
        }

    return deps
}

/** Required dependency IDs that aren't registered preventing plugin activation. */
export function getMissingPluginDependencies(plugin: AnyPlugin): string[] {
    const { dependencies } = plugin.manifest
    if (!dependencies) return []

    const missing: string[] = []
    for (const [depId, spec] of Object.entries(dependencies))
        if (!spec.optional && !pList.has(depId)) missing.push(depId)

    return missing
}

/**
 * Resolves plugins depending on target plugin from manifest declarations.
 *
 * @param includeLinkedOptionals Includes linked optional dependents. Used for stop cascades.
 */
export function getPluginDependents(
    plugin: AnyPlugin,
    includeLinkedOptionals = false,
): AnyPlugin[] {
    const { id } = plugin.manifest
    const dependents: AnyPlugin[] = []
    const enabled = isPluginEnabledInSavedStates(plugin)

    for (const p of pList.values()) {
        const spec = p.manifest.dependencies?.[id]
        if (!spec) continue

        if (!spec.optional) dependents.push(p)
        else if (
            includeLinkedOptionals &&
            enabled &&
            !getInternalPluginMeta(p).unsatisfiedOptionalDependencies.includes(
                id,
            )
        )
            dependents.push(p)
    }

    return dependents
}
