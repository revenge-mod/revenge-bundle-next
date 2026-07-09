import * as jsonStorage from '@revenge-mod/json-storage'
import { getJsonStorage } from '@revenge-mod/json-storage'
import { exists, rm } from '@revenge-mod/modules/native/fs'
import {
    InternalPluginFlags,
    PluginFlags,
    registerPlugin,
} from '@revenge-mod/plugins/_'
import { defineLazyProperty } from '@revenge-mod/utils/object'
import type { JsonStorage, JsonStorageOptions } from '@revenge-mod/json-storage'
import type { InitPluginApi, Plugin } from '@revenge-mod/plugins/types'
import type { AnyObject } from '@revenge-mod/utils/types'

type PluginJsonStorageOptions = JsonStorageOptions & {
    file?: string
}

const storageOptions = new WeakMap<Plugin<any, any>, PluginJsonStorageOptions>()

registerPlugin(
    {
        id: 'revenge.api.json-storage',
        name: 'JSON Storage API',
        description: '@revenge-mod/json-storage API for plugins.',
        author: 'Revenge',
        icon: 'PollsIcon',
    },
    {
        preInit({ decorate, unscoped }) {
            unscoped.jsonStorage = jsonStorage

            decorate((plugin, { jsonStorage }) => {
                if (jsonStorage) storageOptions.set(plugin, jsonStorage)
            })
        },
        init({ decorate }) {
            const makePluginStorage = (
                plugin: Plugin,
                opts?: PluginJsonStorageOptions,
            ) =>
                getJsonStorage(
                    jsonStorage.pluginStoragePathFor(
                        plugin.manifest.id,
                        opts?.file,
                    ),
                    opts,
                )

            decorate(plugin => {
                const opts = storageOptions.get(plugin)

                if (opts?.load)
                    plugin.api.jsonStorage = makePluginStorage(plugin, opts)
                else
                    defineLazyProperty(plugin.api, 'jsonStorage', () =>
                        makePluginStorage(plugin, opts),
                    )
            })
        },
    },
    PluginFlags.Enabled,
    // biome-ignore format: Don't format this
    InternalPluginFlags.Internal |
    InternalPluginFlags.Essential |
    InternalPluginFlags.API,
)

export async function deleteJsonStorageForPlugin(plugin: Plugin<any, any>) {
    const opts = storageOptions.get(plugin)!

    const path = jsonStorage.pluginStoragePathFor(plugin.manifest.id, opts.file)

    if (await exists(path)) await rm(path)

    const api = plugin.api as
        | InitPluginApi<{ jsonStorage: AnyObject }>
        | undefined

    const storage = api?.jsonStorage as JsonStorage<AnyObject> | undefined
    await storage?.get()
}
