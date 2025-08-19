import {
    callBridgeMethod,
    callBridgeMethodSync,
} from '@revenge-mod/modules/native'
import { debounce } from '@revenge-mod/utils/callback'
import type { Metro } from '@revenge-mod/modules/types'
import type { Asset } from './types'

const ExpectedCacheVersion = 2

export const Uncached: Cache = {
    data: {},
    version: ExpectedCacheVersion,
}

// In-memory cache
export let cache: Cache =
    callBridgeMethodSync('revenge.caches.assets.read', []) ?? Uncached

if (cache.version !== ExpectedCacheVersion) {
    // TODO: Alert to user to update build
    cache = Uncached
}

export interface Cache {
    data: {
        [key: Asset['name']]: {
            [key: Asset['type']]: Metro.ModuleID
        }
    }
    version: number
}

const save = debounce(() => {
    callBridgeMethod('revenge.caches.assets.write', [cache.data])
}, 1000)

export function cacheAsset(asset: Asset, moduleId: Metro.ModuleID) {
    const reg = (cache.data[asset.name] ??= {})
    reg[asset.type] = moduleId

    save()
}

declare module '@revenge-mod/modules/native' {
    interface Methods {
        'revenge.caches.assets.read': [[], Cache | null]
        'revenge.caches.assets.write': [[data: Cache['data']], void]
    }
}
