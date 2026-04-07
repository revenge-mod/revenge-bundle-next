import { InternalPluginFlags, registerPlugin } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import defer * as UtilsCallback from '@revenge-mod/utils/callback'
import defer * as UtilsDiscord from '@revenge-mod/utils/discord'
import defer * as UtilsError from '@revenge-mod/utils/error'
import defer * as UtilsObject from '@revenge-mod/utils/object'
import defer * as UtilsPromise from '@revenge-mod/utils/promise'
import defer * as UtilsProxy from '@revenge-mod/utils/proxy'
import defer * as UtilsReact from '@revenge-mod/utils/react'
import defer * as UtilsTree from '@revenge-mod/utils/tree'

registerPlugin(
    {
        id: 'revenge.api.utils',
        name: 'Utils API',
        description: '@revenge-mod/utils API for plugins.',
        author: 'Revenge',
        icon: 'PollsIcon',
    },
    {
        preInit({ unscoped }) {
            unscoped.utils = {
                callback: UtilsCallback,
                error: UtilsError,
                object: UtilsObject,
                promise: UtilsPromise,
                proxy: UtilsProxy,
                tree: UtilsTree,
                react: UtilsReact,
            }
        },
        init({ unscoped: { utils } }) {
            utils.discord = UtilsDiscord
        },
    },
    PluginFlags.Enabled,
    // biome-ignore format: Don't format this
    InternalPluginFlags.Internal |
    InternalPluginFlags.Essential |
    InternalPluginFlags.API,
)
