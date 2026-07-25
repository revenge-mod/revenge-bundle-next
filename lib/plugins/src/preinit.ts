import { isPluginStartable, preInitPlugin } from './_internal'
import { computePendingNodes, pListOrdered } from './_internal/dependency-graph'
import { registerExternalPlugins } from './_internal/external-plugins'

registerExternalPlugins()
computePendingNodes()

for (const plugin of pListOrdered)
    if (isPluginStartable(plugin)) preInitPlugin(plugin)
