import { getAssetByName } from '@revenge-mod/assets'
import { ImportTrackerModuleId } from '@revenge-mod/discord/common/import-tracker'
import { TokensModuleId } from '@revenge-mod/discord/common/tokens'
import { lookupModule } from '@revenge-mod/modules/finders'
import {
    createFilterGenerator,
    withDependencies,
} from '@revenge-mod/modules/finders/filters'
import { isModuleExportBad } from '@revenge-mod/modules/metro/utils'
import { FilterScopes } from '../../modules/src/finders/filters/constants'
import type {
    Filter,
    FilterGenerator,
} from '@revenge-mod/modules/finders/filters'
import type { Metro } from '@revenge-mod/modules/types'
import type { FC } from 'react'

const { last } = withDependencies

const depsFilters: Record<string, Filter> = {}

/**
 * Builds a dependency filter for an icon component.
 *
 * `[React, (ReactNative), ReactJsxRuntime, Tokens, (BaseIconImage), (...Assets), ImportTracker]`
 *
 * `ReactNative` is only present on components with multiple assets, and it sits right after `React`,
 * so everything from `ReactJsxRuntime` onwards is at a fixed distance from the end on both shapes.
 *
 * @param names The component name, then the asset names if the component has multiple assets.
 * @returns The filter, or `undefined` if any of the assets aren't registered yet.
 */
function depsFilterFor(names: string[]) {
    const key = names.join(',')
    const cached = depsFilters[key]
    if (cached) return cached

    // Components with multiple assets are named separately from their assets
    const assets = names.length > 1 ? names.slice(1) : names
    const mids: Metro.ModuleID[] = []

    for (const name of assets) {
        const mid = getAssetByName(name)?.moduleId
        // Module ID can never be zero, so if it's falsy, it means the asset was not found.
        if (!mid) return

        mids.push(mid)
    }

    return (depsFilters[key] = withDependencies(
        last([TokensModuleId, null, ...mids, ImportTrackerModuleId]),
    ))
}

export type WithGeneratedIconComponent = FilterGenerator<
    <N extends string>(
        name: N,
        ...assets: string[]
    ) => Filter<{
        Result: { [K in N]: FC<any> }
        Scopes: [
            typeof FilterScopes.Uninitialized,
            typeof FilterScopes.Initialized,
        ]
    }>
>

/**
 * Filter by icon component name and asset names.
 *
 * @param names The component name, then the asset names if the component has multiple assets. *
 * @example
 * ```ts
 * const [CopyIconModule] = lookupModule(
 *   withGeneratedIconComponent('CopyIcon'),
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
 * )
 * ```
 */
export const withGeneratedIconComponent = createFilterGenerator<
    Parameters<WithGeneratedIconComponent>
>(
    (names, id, exports, initialized) => {
        // Icon components always export their component, so unusable exports can never match
        if (initialized && isModuleExportBad(exports)) return false

        return depsFilterFor(names)?.(id, exports, initialized) ?? false
    },
    names => `revenge.utils.discord.generatedIconComponent(${names.join(',')})`,
    FilterScopes.Uninitialized | FilterScopes.Initialized,
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

    const [module] = lookupModule(withGeneratedIconComponent(...names))

    return module?.[names[0]] as FC<any> | undefined
}

function warnUnregisteredAsset(name: string) {
    nativeLoggingHook(
        `\u001b[31mAsset "${name}" is not registered. Cannot get module ID to filter by.\u001b[0m`,
        2,
    )
}
