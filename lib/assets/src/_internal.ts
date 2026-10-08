import type { AssetRegisteredCallback } from '.'
import type { Asset, AssetOverride, CustomAsset } from './types'

export const aCustoms = new Set<CustomAsset>()
export const aOverrides = new WeakMap<Asset, AssetOverride>()
export const aNameOverrides = new Map<Asset['name'], AssetOverride>()

export const aSubsAny = new Set<AssetRegisteredCallback>()
export const aSubs = new Map<Asset['name'], Set<AssetRegisteredCallback>>()

export function executeAssetSubscriptions(asset: Asset) {
    for (const cb of aSubsAny)
        try {
            cb(asset)
        } catch {}

    const subs = aSubs.get(asset.name)
    if (subs)
        for (const cb of subs)
            try {
                cb(asset)
            } catch {}
}

/** Resolves an override, keeping the original dimensions when the override has none. */
export function resolveAssetOverride(asset: Asset) {
    const override = aOverrides.get(asset) ?? aNameOverrides.get(asset.name)
    if (!override) return

    return {
        ...override,
        width: override.width ?? asset.width,
        height: override.height ?? asset.height,
        scale: override.scale ?? 1,
    }
}
