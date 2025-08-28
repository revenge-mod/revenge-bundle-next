import { getAssetByName } from '@revenge-mod/assets'
import { TokensModuleId } from '@revenge-mod/discord/common'
import { lookupModule } from '@revenge-mod/modules/finders'
import {
    createFilterGenerator,
    withDependencies,
} from '@revenge-mod/modules/finders/filters'
import {
    ReactJSXRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { FilterFlag } from '#modules/src/finders/filters/constants'
import type {
    Filter,
    FilterGenerator,
} from '@revenge-mod/modules/finders/filters'
import type { FC } from 'react'

// [React, ReactJsxRuntime, (Tokens), (BaseIconImage), (Asset), 2]
// Asset = relativeDep(1)
const IconComponentFilter = [
    ReactModuleId,
    ReactJSXRuntimeModuleId,
    TokensModuleId,
    null,
    null,
    2,
]

// Generated IconComponents that have multiple assets, there is no specific length, so the filter has to be generated on-the-fly.
// [React, ReactNative, ReactJsxRuntime, (Tokens), (BaseIconImage), (...Assets), 2]
// ...Assets = relativeDep(1..n)
const MultiIconComponentFilterBase = [
    ReactModuleId,
    ReactNativeModuleId,
    ReactJSXRuntimeModuleId,
    TokensModuleId,
    null,
]

export type WithGeneratedIconComponent = FilterGenerator<
    <N extends string>(
        name: N,
        ...assets: string[]
    ) => Filter<{ [K in N]: FC<any> }>
>

/**
 * Filter by icon component name and asset names.
 *
 * **Make sure to set `uninitialized: true` when using this filter in `lookupModule`!**
 *
 * @param names The component name, then the asset names if the component has multiple assets. *
 * @example
 * ```ts
 * const [CopyIconModule] = lookupModule(
 *   withGeneratedIconComponent('CopyIcon'),
 *   {
 *     uninitialized: true,
 *   }
 * )
 * if (CopyIconModule) {
 *   const { CopyIcon } = CopyIconModule
 *   // Use CopyIcon as a React component
 * }
 * ```
 * @example
 * ```ts
 * const [CircleXIconModule] = lookupModule(
 *   withGeneratedIconComponent(
 *     'CircleXIcon',
 *     'CircleXIcon-secondary',
 *     'CircleXIcon-primary',
 *   ),
 *   {
 *    uninitialized: true,
 *   }
 * )
 * ```
 */
export const withGeneratedIconComponent = createFilterGenerator<
    Parameters<WithGeneratedIconComponent>
>(
    (names, id, exports) => {
        if (typeof exports === 'object') {
            if (typeof exports[names[0]] === 'function')
                return Object.keys(exports).length === 1
        } else {
            let filter = IconComponentFilter

            if (names.length > 1) {
                const mids = []

                for (let i = 1; i < names.length; i++) {
                    const name = names[i]
                    const mid = getAssetByName(name)?.moduleId
                    // Module ID can never be zero, so if it's falsy, it means the asset was not found.
                    if (!mid) return false

                    mids.push(mid)
                }

                filter = [...MultiIconComponentFilterBase, ...mids, 2]
            } else {
                const [name] = names

                const mid = getAssetByName(name)?.moduleId
                // Module ID can never be zero, so if it's falsy, it means the asset was not found.
                if (!mid) return false

                IconComponentFilter[4] = mid
            }

            return withDependencies(filter)(id, exports)
        }

        return false
    },
    names => `revenge.utils.discord.generatedIconComponent(${names.join(',')})`,
    FilterFlag.Dynamic,
) as WithGeneratedIconComponent

/**
 * Looks up a generated icon component by its name and asset names.
 *
 * @param names The component name, then the asset names if the component has multiple assets.
 * @returns The icon component, or `undefined` if it could not be found.
 */
export function lookupGeneratedIconComponent<N extends string>(
    ...names: [N, ...string[]]
) {
    for (const name of names) {
        let badFind = false
        if (__DEV__) {
            if (!getAssetByName(name)) {
                badFind = true
                warnUnregisteredAsset(name)
            }
        } else if (!getAssetByName(name)) return
        if (__DEV__ && badFind) return
    }

    const [module] = lookupModule(withGeneratedIconComponent(...names), {
        uninitialized: true,
    })

    return module?.[names[0]] as FC<any> | undefined
}

function warnUnregisteredAsset(name: string) {
    nativeLoggingHook(
        `\u001b[31mAsset "${name}" is not registered. Cannot get module ID to filter by.\u001b[0m`,
        2,
    )
}
