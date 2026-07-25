import * as PluginsApiConstants from '@revenge-mod/plugins/constants'
import * as PluginsApiUtils from '@revenge-mod/plugins/utils'

export interface PluginApiPlugins {
    utils: typeof import('@revenge-mod/plugins/utils')
    constants: typeof import('@revenge-mod/plugins/constants')
}

export const plugins: PluginApiPlugins = {
    constants: PluginsApiConstants,
    utils: PluginsApiUtils,
}
