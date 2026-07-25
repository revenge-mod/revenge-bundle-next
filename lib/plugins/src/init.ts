import { initPlugin, isPluginStartable } from './_internal'
import { computePendingNodes, pListOrdered } from './_internal/dependency-graph'

computePendingNodes()

for (const plugin of pListOrdered)
    if (isPluginStartable(plugin)) initPlugin(plugin)
