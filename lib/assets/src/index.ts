import { Platform } from 'react-native'
import { aCustoms, aOverrides } from './_internal'
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
    AssetsRegistry,
    AssetsRegistryModuleId,
} from './preinit'

// Resolve reference once and keep in closure
const metroRequire = __r

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
    for (const asset of aCustoms) yield asset
}

/**
 * Yields all registered packager assets, including ones with same name but different types.
 */
export function* getPackagerAssets(): Generator<PackagerAsset> {
    for (const reg of Object.values(cache.data))
        for (const moduleId of Object.values(reg))
            yield AssetsRegistry.getAssetByID(metroRequire(moduleId))
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
    const reg = cache.data[name]
    if (!reg) return

    return Object.entries(reg).reduce(
        (acc, [type, mid]) => {
            acc[type as Asset['type']] = AssetsRegistry.getAssetByID(
                metroRequire(mid),
            )!
            return acc
        },
        {} as Record<Asset['type'], Asset>,
    )
}

/**
 * Get an asset ID by its name.
 *
 * If more than one asset is registered with the same name, this will return the one with the preferred type.
 *
 * Unless **explicitly** calling with a preferred type,
 * another asset with type mismatching the {@link setPreferredAssetType current preferred type} may be returned as a fallback.
 *
 * @param name The asset name.
 * @param type The preferred asset type, defaults to the current preferred type.
 */
export function getAssetIdByName(
    name: string,
    type?: Asset['type'],
): AssetId | undefined {
    const reg = cache.data[name]
    if (!reg) return

    if (type !== undefined) {
        const mid = reg[type]
        return mid && metroRequire(mid)
    }

    let mid = reg[_preferredType]
    mid ??= Object.values(reg)[0]

    return mid && metroRequire(mid)
}

/**
 * Register an asset with the given name.
 *
 * @param asset The asset to register.
 * @returns The asset ID.
 */
export function registerAsset(asset: RegisterableAsset): AssetId {
    if (cache.data[asset.name]?.[asset.type] !== undefined)
        throw new Error(
            `Asset with name ${asset.name} and type ${asset.type} already exists!`,
        )

    aCustoms.add(asset as CustomAsset)

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
    aOverrides.set(asset, override)
}

/**
 * Remove an asset override.
 *
 * @param asset The asset to remove the override for.
 * @returns The asset that was removed.
 */
export function removeAssetOverride(asset: Asset) {
    return aOverrides.delete(asset)
}
