import * as UtilsCallback from '@revenge-mod/utils/callback'
import defer * as UtilsDiscord from '@revenge-mod/utils/discord'
import * as UtilsError from '@revenge-mod/utils/error'
import * as UtilsObject from '@revenge-mod/utils/object'
import * as UtilsPromise from '@revenge-mod/utils/promise'
import * as UtilsProxy from '@revenge-mod/utils/proxy'
import * as UtilsReact from '@revenge-mod/utils/react'
import * as UtilsTree from '@revenge-mod/utils/tree'
import { guardIndexInitialized } from '.'
import type { PluginApiUtils } from '@revenge-mod/utils/types'

export const utils = UtilsObject.defineLazyProperties(
    {
        callback: UtilsCallback,
        error: UtilsError,
        object: UtilsObject,
        promise: UtilsPromise,
        proxy: UtilsProxy,
        tree: UtilsTree,
        react: UtilsReact,
    } as PluginApiUtils,
    {
        discord: () => {
            guardIndexInitialized('utils.discord')
            return UtilsDiscord
        },
    },
)
