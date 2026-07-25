import { getPluginDependencies, isPluginStartable } from '../_internal'
import { pApis } from './decorators'
import type { AnyPlugin } from '../_internal'

/// PLUGIN DEPENDENCY GRAPHING

// We don't store the graph as a tree, but rather as a set of nodes.

// Root nodes are plugins that have dependencies, but no dependents. These plugins are the starting points of the dependency graph.
// Leaf nodes are plugins that have no dependencies, but may have dependents. These plugins are the end points of the dependency graph.

// Start order: Single nodes (no dependencies & dependents) -> Leaf nodes (no dependencies, maybe dependents) -> Root nodes (with dependencies, no dependents)
// This way we can ensure that all dependencies are started before the plugin itself.

export const pRootNodes = new Set<AnyPlugin>()
export const pLeafOrSingleNodes = new Set<AnyPlugin>()

// Visited non-leaf nodes
const visited = new Set<AnyPlugin>()

// Ordered list of plugins to be started
export const pListOrdered: AnyPlugin[] = []
// Pending plugins to be computed
export const pPending = new Set<AnyPlugin>()

// Reserved dependencies verified by native
export const ApiDependencyId = 'revenge.api'
export const DiscordDependencyId = 'discord'

export function isReservedDependency(id: string) {
    return id === ApiDependencyId || id === DiscordDependencyId
}

/**
 * Whether the plugin has start-order dependencies. Reserved dependencies don't count.
 */
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
        // Optimisitically add to root nodes (if there are dependents, it will be removed later)
        pRootNodes.add(plugin)

        // Not a root node if it has dependencies
        for (const dep of getPluginDependencies(plugin, false))
            if (hasGraphableDependencies(dep)) pRootNodes.delete(dep)
    } else pLeafOrSingleNodes.add(plugin)
}
