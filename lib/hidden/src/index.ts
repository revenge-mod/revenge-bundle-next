import { defineLazyProperties } from '@revenge-mod/utils/object'
import defer * as AssetsInternal from '../../assets/src/_internal'
import defer * as AssetsCaches from '../../assets/src/caches'
import defer * as ComponentsInternal from '../../components/src/_internal'
import defer * as DiscordSettingsInternal from '../../discord/src/modules/settings/_internal'
import defer * as DiscordFluxPatches from '../../discord/src/patches/flux'
import defer * as DiscordImportTracker from '../../discord/src/patches/import-tracker'
import defer * as ModulesCaches from '../../modules/src/caches'
import defer * as ModulesFindersInternal from '../../modules/src/finders/_internal'
import defer * as MetroPatches from '../../modules/src/metro/patches'
import defer * as MetroRuntime from '../../modules/src/metro/runtime'
import defer * as MetroSubscriptionsInternal from '../../modules/src/metro/subscriptions/_internal'
import defer * as ModulesNativeInternal from '../../modules/src/native/_internal'
import defer * as PatcherInternal from '../../patcher/src/_internal'
import defer * as PluginsDecorators from '../../plugins/src/_internal/decorators'
import defer * as PluginsDependencyGraph from '../../plugins/src/_internal/dependency-graph'
import defer * as PluginsExternal from '../../plugins/src/_internal/external-plugins'
import defer * as PluginsInternal from '../../plugins/src/_internal/index'
import defer * as PluginsRepositories from '../../plugins/src/_internal/repositories'
import defer * as PluginsApis from '../../plugins/src/apis/index'
import defer * as ReactJsxRuntimeInternal from '../../react/src/jsx-runtime/_internal'
import defer * as ReactNativeInternal from '../../react/src/native/_internal'
import defer * as Helpers from './helpers'
import type {
    HiddenApi,
    HiddenApiAssets,
    HiddenApiDiscord,
    HiddenApiModules,
    HiddenApiModulesMetro,
    HiddenApiPlugins,
    HiddenApiReact,
} from './types'

export * from './types'

export const hiddenApi: HiddenApi = defineLazyProperties({} as HiddenApi, {
    assets: () =>
        ({
            caches: AssetsCaches,
            internal: AssetsInternal,
        }) satisfies HiddenApiAssets,
    components: () => ComponentsInternal,
    discord: () =>
        defineLazyProperties({} as HiddenApiDiscord, {
            flux: () => DiscordFluxPatches,
            importTracker: () => DiscordImportTracker,
            settings: () => DiscordSettingsInternal,
        }),
    helpers: () => Helpers,
    modules: () =>
        ({
            caches: ModulesCaches,
            finders: ModulesFindersInternal,
            metro: {
                patches: MetroPatches,
                runtime: MetroRuntime,
                subscriptions: MetroSubscriptionsInternal,
            } satisfies HiddenApiModulesMetro,
            native: ModulesNativeInternal,
        }) satisfies HiddenApiModules,
    patcher: () => PatcherInternal,
    plugins: () =>
        ({
            apis: PluginsApis,
            decorators: PluginsDecorators,
            dependencyGraph: PluginsDependencyGraph,
            externalPlugins: PluginsExternal,
            internal: PluginsInternal,
            repositories: PluginsRepositories,
        }) satisfies HiddenApiPlugins,
    react: () =>
        ({
            jsxRuntime: ReactJsxRuntimeInternal,
            native: ReactNativeInternal,
        }) satisfies HiddenApiReact,
})
