import { Platform } from 'react-native'
import {
    aCustoms,
    aNameOverrides,
    aOverrides,
    aSubs,
    aSubsAny,
} from './_internal'
import { cache } from './caches'
import { AssetsRegistry } from './preinit'
import type {
    Asset,
    AssetId,
    AssetOverride,
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
 * Override an asset with another source.
 *
 * Overriding by name needs no asset module initialized, and also covers assets registered later.
 * An override for the asset object wins over one for its name.
 *
 * @param asset The asset, or the asset name, to override.
 * @param override The source to use instead.
 */
export function addAssetOverride(
    asset: Asset | Asset['name'],
    override: AssetOverride,
) {
    if (typeof asset === 'string') aNameOverrides.set(asset, override)
    else aOverrides.set(asset, override)
}

/**
 * Remove an asset override.
 *
 * @param asset The asset, or the asset name, to remove the override for.
 * @returns Whether an override was removed.
 */
export function removeAssetOverride(asset: Asset | Asset['name']) {
    if (typeof asset === 'string') return aNameOverrides.delete(asset)
    return aOverrides.delete(asset)
}

export type AssetRegisteredCallback = (asset: Asset) => void

/**
 * Registers a callback called when any asset is registered.
 *
 * Runs inside `registerAsset`, before the asset module returns, so the asset is not used yet.
 *
 * @param callback The callback to be called.
 * @returns A function that unregisters the callback.
 */
export function onAnyAssetRegistered(callback: AssetRegisteredCallback) {
    aSubsAny.add(callback)
    return () => {
        aSubsAny.delete(callback)
    }
}

/**
 * Registers a callback called when an asset with the given name is registered.
 *
 * Runs inside `registerAsset`, before the asset module returns, so the asset is not used yet.
 * Assets of different types can share a name, so this may run more than once.
 *
 * @param name The asset name.
 * @param callback The callback to be called.
 * @returns A function that unregisters the callback.
 */
export function onAssetRegistered(
    name: Asset['name'],
    callback: AssetRegisteredCallback,
) {
    let set = aSubs.get(name)
    if (!set) aSubs.set(name, (set = new Set()))

    set.add(callback)
    return () => {
        set.delete(callback)
        if (!set.size) aSubs.delete(name)
    }
}
