import { getPluginDependencies, isPluginStartable } from '../_internal'
import { pApis } from './decorators'
import type { AnyPlugin } from '../_internal'

// Plugin dependency resolution graph nodes. We need to ensure dependencies are started before the plugin.
// Start order: single nodes, leaf nodes (dependencies satisfied), root nodes.

// Root nodes are plugins with dependencies but no dependents. Starting points of the dependency graph.
// Leaf nodes are plugins with no dependencies, but may have dependents. End points of the dependency graph.

export const pRootNodes = new Set<AnyPlugin>()
export const pLeafOrSingleNodes = new Set<AnyPlugin>()

// Visited non-leaf nodes
const visited = new Set<AnyPlugin>()

// Sorted plugins to be started
export const pListOrdered: AnyPlugin[] = []
// Pending plugins for computation
export const pPending = new Set<AnyPlugin>()

// Reserved dependency IDs verified by native
export const ApiDependencyId = 'revenge.api'
export const DiscordDependencyId = 'discord'

export function isReservedDependency(id: string) {
    return id === ApiDependencyId || id === DiscordDependencyId
}

/** Checks whether plugin declares graphable dependencies outside reserved set. */
function hasGraphableDependencies(plugin: AnyPlugin): boolean {
    const deps = plugin.manifest.dependencies
    if (!deps) return false
    for (const id in deps) if (!isReservedDependency(id)) return true
    return false
}

export function computePendingNodes() {
    for (const plugin of pPending)
        if (isPluginStartable(plugin)) resolvePluginGraph(plugin)

    const apis: AnyPlugin[] = []

    for (const plugin of pLeafOrSingleNodes) {
        if (pApis.has(plugin)) apis.push(plugin)
        else pListOrdered.unshift(plugin)
    }

    for (const plugin of apis) pListOrdered.unshift(plugin)

    const stack = [...pRootNodes]
    while (stack.length) {
        const plugin = stack.shift()!

        if (visited.has(plugin)) {
            pListOrdered.push(plugin)
            continue
        }

        if (hasGraphableDependencies(plugin)) {
            for (const dep of getPluginDependencies(plugin, false))
                if (!pLeafOrSingleNodes.has(dep)) stack.push(dep)

            stack.push(plugin)
            visited.add(plugin)
        } else pListOrdered.push(plugin)
    }

    pPending.clear()
    pLeafOrSingleNodes.clear()
    pRootNodes.clear()
    visited.clear()
}

export function resolvePluginGraph(plugin: AnyPlugin) {
    if (hasGraphableDependencies(plugin)) {
        // Optimisitically mark as root node (if there are dependents, it will be removed)
        pRootNodes.add(plugin)

        // Not a root node if it has dependencies
        for (const dep of getPluginDependencies(plugin, false))
            if (hasGraphableDependencies(dep)) pRootNodes.delete(dep)
    } else pLeafOrSingleNodes.add(plugin)
}
