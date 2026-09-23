import { isPluginStopped } from './predicates'
import { getInternalPluginMeta, pList } from './registry'
import { isPluginEnabledInActiveSlot } from './state'
import type { AnyPlugin } from './types'

/**
 * Resolves dependencies ordered before plugin.
 * Optional dependencies are included only when enabled and satisfied.
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
                    (isPluginEnabledInActiveSlot(dep) &&
                        !unsatisfiedOptionalDependencies.has(depId))
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
 * Derives dependent plugins from manifest dependencies and native satisfaction state.
 *
 * If you're looking for the runtime state, use {@link getLinkedDependents} instead.
 *
 * @param includeOptionals Includes optional dependents that could be linked.
 */
export function getPluginDependents(
    plugin: AnyPlugin,
    includeOptionals = false,
): AnyPlugin[] {
    const { id } = plugin.manifest
    const dependents: AnyPlugin[] = []
    const enabled = isPluginEnabledInActiveSlot(plugin)

    for (const p of pList.values()) {
        const spec = p.manifest.dependencies?.[id]
        if (!spec) continue

        if (!spec.optional) dependents.push(p)
        else if (
            includeOptionals &&
            enabled &&
            !getInternalPluginMeta(p).unsatisfiedOptionalDependencies.has(id)
        )
            dependents.push(p)
    }

    return dependents
}

/**
 * {@link getPluginDependents} but for the currently linked dependents of a running plugin.
 * Linked optional dependents are always included.
 */
export function getLinkedDependents(plugin: AnyPlugin): AnyPlugin[] {
    const { id } = plugin.manifest
    const dependents: AnyPlugin[] = []

    for (const p of pList.values()) {
        const spec = p.manifest.dependencies?.[id]
        if (!spec) continue
        if (isPluginStopped(p)) continue

        if (
            !spec.optional ||
            getInternalPluginMeta(p).linkedDependencies.has(id)
        )
            dependents.push(p)
    }

    return dependents
}

/** Optional dependents of this plugin that are running and linked to it. */
export function getLinkedOptionalDependents(plugin: AnyPlugin): AnyPlugin[] {
    const { id } = plugin.manifest
    return getLinkedDependents(plugin).filter(
        p => p.manifest.dependencies?.[id]?.optional,
    )
}

/** Dependencies of this plugin that cannot be linked right now: not registered, or version unsatisfied. */
export function getUnsatisfiedPluginDependencies(plugin: AnyPlugin): string[] {
    const { unsatisfiedOptionalDependencies } = getInternalPluginMeta(plugin)

    return Object.keys(plugin.manifest.dependencies ?? {}).filter(
        depId =>
            unsatisfiedOptionalDependencies.has(depId) || !pList.has(depId),
    )
}

/** Running dependents that declare this plugin as an optional dependency but didn't link it. */
export function getRelinkableDependents(plugin: AnyPlugin): AnyPlugin[] {
    const { id } = plugin.manifest
    const dependents: AnyPlugin[] = []

    for (const p of pList.values()) {
        if (!p.manifest.dependencies?.[id]?.optional) continue
        if (isPluginStopped(p)) continue

        const meta = getInternalPluginMeta(p)
        if (meta.linkedDependencies.has(id)) continue
        if (meta.unsatisfiedOptionalDependencies.has(id)) continue

        dependents.push(p)
    }

    return dependents
}
