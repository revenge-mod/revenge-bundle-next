import * as assets from '@revenge-mod/assets'
import defer * as Components from '@revenge-mod/components'
import { isModuleInitialized } from '@revenge-mod/modules/metro/utils'
import * as patcher from '@revenge-mod/patcher'
import { defineLazyProperties } from '@revenge-mod/utils/object'
import defer * as Discord from './discord'
import { externals } from './externals'
import { modules } from './modules'
import { plugins } from './plugins'
import { react } from './react'
import type {
    UnscopedInitPluginApi,
    UnscopedPluginApi,
    UnscopedPreInitPluginApi,
} from '../types'

// @ts-expect-error: This will be modified by libraries later
export const pUnscopedApi:
    | UnscopedPreInitPluginApi
    | UnscopedInitPluginApi
    | UnscopedPluginApi = {
    modules,
    patcher,
    plugins,
    react,
    assets,
    externals,
}

defineLazyProperties(pUnscopedApi, {
    components: () => {
        guardIndexInitialized('Components')
        return Components
    },
})

defineLazyProperties(pUnscopedApi, {
    discord: () => {
        return Discord.discord
    },
})

export function guardIndexInitialized(name: string) {
    if (!isModuleInitialized(0))
        throw new Error(
            `Cannot access ${name} API before the init phase: Index module (ID 0) must be initialized first.\n` +
                'Place your accessing code in the `init() { ... }` block or use `onModuleInitialized(0, () => { ... })` to ensure that the index module is initialized before accessing the API.',
        )
}

export function spreadDescriptors<T extends object, U extends object>(
    from: T,
    to: U,
): T & U {
    return Object.defineProperties(
        to,
        Object.getOwnPropertyDescriptors(from),
    ) as T & U
}
