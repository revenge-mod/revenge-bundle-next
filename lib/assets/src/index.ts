import { Platform } from 'react-native'
import { _customs, _overrides } from './_internal'
import { cache } from './caches'
import { AssetsRegistry } from './preinit'
import type {
    Asset,
    AssetId,
    CustomAsset,
    PackagerAsset,
    RegisterableAsset,
} from './types'

export {
    AssetsRegistry as AssetRegistry,
    AssetsRegistryModuleId as AssetRegistryModuleId,
} from './preinit'

// iOS cannot display SVGs
let _preferredType: Asset['type'] = Platform.OS === 'ios' ? 'png' : 'svg'

/**
 * Set the preferred asset type. This is used to determine which asset to use when multiple types are available.
 *
 * @param type The preferred asset type.
 */
export function setPreferredAssetType(type: Asset['type']) {
    _preferredType = type
}

/**
 * Yields all assets, both packager and custom.
 */
export function* getAssets(): Generator<Asset> {
    yield* getPackagerAssets()
    yield* getCustomAssets()
}

/**
 * Yields all registered custom assets.
 */
export function* getCustomAssets(): Generator<CustomAsset> {
    for (const asset of _customs) yield asset
}

/**
 * Yields all registered packager assets, including ones with same name but different types.
 */
export function* getPackagerAssets(): Generator<PackagerAsset> {
    for (const name in cache) {
        const reg = cache[name]
        for (const type in reg)
            yield AssetsRegistry.getAssetByID(__r(reg[type]))
    }
}

/**
 * Get an asset by its name.
 * If more than one asset is registered with the same name, this will return the one with the preferred type, or the first registered one.
 *
 * @param name The asset name.
 * @param type The preferred asset type, defaults to the current preferred type.
 */
export function getAssetByName(
    name: string,
    type?: Asset['type'],
): Asset | undefined {
    const id = getAssetIdByName(name, type)
    if (id !== undefined) return AssetsRegistry.getAssetByID(id)
}

/**
 * Gets all assets matching the name.
 *
 * @param name The asset name.
 * @returns A record keyed by the type of the asset, with the value being the asset itself.
 */
export function getAssetsByName(
    name: string,
): Record<Asset['type'], Asset> | undefined {
    const reg = cache[name]
    if (!reg) return

    return Object.entries(reg).reduce(
        (acc, [type, mid]) => {
            acc[type as Asset['type']] = AssetsRegistry.getAssetByID(__r(mid))!
            return acc
        },
        {} as Record<Asset['type'], Asset>,
    )
}

/**
 * Get an asset ID by its name.
 * If more than one asset is registered with the same name, this will return the one with the preferred type, or the first registered one.
 *
 * @param name The asset name.
 * @param type The preferred asset type, defaults to the current preferred type.
 */
export function getAssetIdByName(
    name: string,
    type?: Asset['type'],
): AssetId | undefined {
    const reg = cache[name]
    if (!reg) return

    if (type) {
        const mid = reg[type]
        if (mid === undefined) return
        return __r(mid)
    }

    let mid = reg[_preferredType]
    if (mid === undefined)
        for (const t in reg) {
            mid = reg[t]
            break
        }

    if (mid === undefined) return

    return __r(mid)
}

/**
 * Register an asset with the given name.
 *
 * @param asset The asset to register.
 * @returns The asset ID.
 */
export function registerAsset(asset: RegisterableAsset): AssetId {
    if (cache[asset.name]?.[asset.type] !== undefined)
        throw new Error(
            `Asset with name ${asset.name} and type ${asset.type} already exists!`,
        )

    _customs.add(asset as CustomAsset)

    // @ts-expect-error
    return AssetsRegistry.registerAsset(asset)
}

/**
 * Override an asset with a custom asset.
 *
 * @param asset The asset to override.
 * @param override The custom asset to override with.
 */
export function addAssetOverride(asset: Asset, override: Asset) {
    _overrides.set(asset, override)
}

/**
 * Remove an asset override.
 *
 * @param asset The asset to remove the override for.
 * @returns The asset that was removed.
 */
export function removeAssetOverride(asset: Asset) {
    return _overrides.delete(asset)
}
