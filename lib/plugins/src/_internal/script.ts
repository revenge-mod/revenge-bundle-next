import { pUnscopedApi } from '../apis'
import type { AnyFunction } from '@revenge-mod/utils/types'
import type {
    PluginLifecycles,
    PluginOptions,
    PluginOptionsFactory,
} from '../types'

function assertIsFunction(
    name: string,
    value: unknown,
): asserts value is AnyFunction {
    if (typeof value !== 'function')
        throw new Error(`${name} must be a function, got ${typeof value}`)
}

/** Creates options factory from external plugin script. */
export function createOptionsFactory(
    id: string,
    script?: string,
): PluginOptionsFactory {
    if (!script) return () => ({})

    return () => {
        const opts = new Function(
            'revenge',
            'plugin',
            `return ${script}\n//# sourceURL=Revenge:Plugin:${id}`,
        )(
            pUnscopedApi,
            // See types.consumers.ts
            (opts: PluginOptions) => opts,
        )?.default

        if (typeof opts !== 'object' || opts === null)
            throw new Error('Plugin options must be an object')

        if (
            opts.SettingsComponent !== undefined &&
            typeof opts.SettingsComponent !== 'function'
        )
            throw new Error(
                'SettingsComponent must be a function React component',
            )

        for (const key of ['preInit', 'init', 'start'] as Array<
            keyof PluginLifecycles
        >) {
            if (opts[key] !== undefined) assertIsFunction(key, opts[key])
        }

        return opts
    }
}
