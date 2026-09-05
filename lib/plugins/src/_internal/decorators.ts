import { noop } from '@revenge-mod/utils/callback'
import { getInternalPluginMeta, getPluginDependencies } from '.'
import type { PluginApiDecorator } from '../types'
import type { AnyPlugin, InternalPluginMeta } from '.'

export type PluginApiDecoratorStore<T extends 'PreInit' | 'Init' | 'Start'> =
    WeakMap<AnyPlugin, PluginApiDecorator<any, T>[]>

// Plugins that always decorate the API of every other plugin.
export const pApis = new Set<AnyPlugin>()

export const pDecoratorsPreInit: PluginApiDecoratorStore<'PreInit'> =
    new WeakMap()
export const pDecoratorsInit: PluginApiDecoratorStore<'Init'> = new WeakMap()
export const pDecoratorsStart: PluginApiDecoratorStore<'Start'> = new WeakMap()

export function addPluginApiDecorator(
    store: PluginApiDecoratorStore<any>,
    plugin: AnyPlugin,
    decorator: PluginApiDecorator<any, any>,
) {
    let list = store.get(plugin)
    if (!list) {
        list = []
        store.set(plugin, list)
    }

    list.push(decorator)
}

export function decoratePluginApi(
    store: PluginApiDecoratorStore<any>,
    plugin: AnyPlugin,
    meta: InternalPluginMeta,
) {
    if (!pApis.has(plugin))
        // Apply implicit API decorators from internal API plugins
        for (const dep of pApis) {
            const decorators = store.get(dep)
            if (decorators)
                for (const decorator of decorators)
                    decorator(plugin, meta.options)
        }

    const deps = getPluginDependencies(plugin)
    const { handleError: handleDependentError } = meta

    for (const dep of deps) {
        const decorators = store.get(dep)

        if (decorators) {
            const { handleError } = getInternalPluginMeta(dep)

            try {
                for (const decorator of decorators) {
                    const cleanup = decorator(plugin, meta.options)
                    if (cleanup) plugin.api.cleanup(cleanup)
                }
            } catch (e) {
                handleError(e)
                handleDependentError(e)
            }
        }
    }
}
