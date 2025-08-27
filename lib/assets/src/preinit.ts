import {
    lookupModule,
    lookupModules,
    waitForModules,
} from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withName,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import {
    mInitializingId,
    mUninitialized,
} from '@revenge-mod/modules/metro/patches'
import { getModuleDependencies } from '@revenge-mod/modules/metro/utils'
import { proxify } from '@revenge-mod/utils/proxy'
import { aOverrides } from './_internal'
import { cacheAsset, cached } from './caches'
import type { Metro } from '@revenge-mod/modules/types'
import type { ReactNative } from '@revenge-mod/react/types'
import type { Asset, PackagerAsset } from './types'

const { relative } = withDependencies

const [, _classCallCheckId] = lookupModule(withName('_classCallCheck'))
const [, _createClassId] = lookupModule(withName('_createClass'))

// https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Image/AssetSourceResolver.js
const withAssetSourceResolver = withDependencies([
    _classCallCheckId,
    _createClassId,
    relative(1),
    relative(2),
    null,
    null,
])

const cachedOnly = { cached: true }

// Tracking/caching assets
const unsubAR = waitForModules(
    withProps<ReactNative.AssetsRegistry>('registerAsset'),
    (exports, id) => {
        AssetsRegistryModuleId = id
        AssetsRegistry = exports as ReactNative.AssetsRegistry

        // There are two matching exports. One is the original, and one is a re-export.
        // The original asset-registry is simply required by the re-exported one with no changes.

        // This is the re-exported registry, because it has dependencies.
        // We can begin the caching process here, asset registrar modules have the reexported registry as a dependency.
        if (getModuleDependencies(id)!.length) {
            unsubAR()

            // TODO(lib/assets/caches): Ideally we should not wait for the cache promise here, see the promise impl for more info.
            cached.then(cached => {
                if (!cached) {
                    // Resolve reference once and keep in closure
                    const metroRequire = __r

                    // More fragile way, but also more performant:
                    // There is exactly one asset before the reexported asset registry :/
                    const firstAssetModuleId = id - 1
                    for (const mId of mUninitialized) {
                        if (mId < firstAssetModuleId) continue

                        const deps = getModuleDependencies(mId)!
                        if (deps.length === 1 && deps[0] === id)
                            metroRequire(mId)
                    }
                }
            })

            // We already patched the original asset registry, so we don't need to patch again.
            return
        }

        const orig = exports.registerAsset
        exports.registerAsset = (asset: Asset) => {
            const result = orig(asset as PackagerAsset)

            // Cache and set moduleId for packager assets only
            if ((asset as PackagerAsset).__packager_asset) {
                asset.moduleId = mInitializingId
                cacheAsset(asset, mInitializingId!)
            }

            return (asset.id = result)
        }
    },
    cachedOnly,
)

/**
 * If you need to use this ID, unproxify {@link AssetsRegistry} first.
 *
 * ```js
 * preinit() {
 *   unproxify(AssetsRegistry)
 *   // Module ID will now be set!
 *   AssetsRegistryModuleId // ...
 * }
 * ```
 */
export let AssetsRegistryModuleId: Metro.ModuleID | undefined
export let AssetsRegistry: ReactNative.AssetsRegistry = proxify(() => {
    for (const [, id] of lookupModules(withDependencies([[]]), {
        initialize: false,
        uninitialized: true,
    })) {
        const deps = getModuleDependencies(id)!
        if (deps.length !== 1) continue

        // The module next to assets-registry is AssetSourceResolver
        if (withAssetSourceResolver(deps[0] + 1)) {
            const module = __r(id)
            // ID will be set by the wait below
            if (module?.registerAsset) return (AssetsRegistry = module)
        }
    }

    throw new Error('assets-registry not found')
})

// Asset overrides
const unsubRAS = waitForModules(
    withName<{
        addCustomSourceTransformer: (
            transformer: (arg: { asset: Asset }) => PackagerAsset,
        ) => void
    }>('resolveAssetSource'),
    rAS => {
        unsubRAS()

        // Custom assets
        // Why do we need to do this? Because RN/Discord (unsure which) will attempt to resolve the asset via its path, which we don't provide via custom assets.
        // This will result in a crash, because it tries to read the path and run checks on it, but the path is undefined.
        // @ts-expect-error
        rAS.addCustomSourceTransformer(({ asset }) => {
            if (!(asset as PackagerAsset).__packager_asset) return asset
        })

        // Asset overrides
        // @ts-expect-error
        rAS.addCustomSourceTransformer(({ asset }) => aOverrides.get(asset))
    },
    cachedOnly,
)
