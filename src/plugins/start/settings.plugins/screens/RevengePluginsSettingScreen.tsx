import { useNavigation, useRoute } from '@react-navigation/native'
import { getAssetIdByName } from '@revenge-mod/assets'
import { styles } from '@revenge-mod/components/_'
import Page from '@revenge-mod/components/Page'
import SearchInput from '@revenge-mod/components/SearchInput'
import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { BundleUpdaterManager } from '@revenge-mod/discord/native'
import {
    getInternalPluginMeta,
    InternalPluginFlags,
    isPluginEnabled,
    isPluginEssential,
    isPluginInternal,
    isPluginPendingReload,
    isPluginPendingUpdate,
    pEmitter,
    pList,
} from '@revenge-mod/plugins/_'
import { isDefaultsOnlyBoot } from '@revenge-mod/plugins/constants'
import { debounce } from '@revenge-mod/utils/callback'
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react'
import { View } from 'react-native'
import { ClickOutsideProvider } from 'react-native-click-outside'
import RevengeIcon from '~assets/RevengeIcon'
import { InstalledPluginMasonryFlashList } from '../components/PluginList'
import PluginStatesProvider from '../components/PluginStateProvider'
import {
    EnablePluginTooltipProvider,
    EssentialPluginTooltipProvider,
} from '../components/TooltipProvider'
import { RouteNames, Setting } from '../constants'
import type { NavigationProp, RouteProp } from '@react-navigation/core'
import type { ReactNavigationParamList } from '@revenge-mod/externals/react-navigation'
import type { FilterAndSortActionSheetProps } from '../components/FilterAndSortActionSheet'

const { Stack, IconButton, FloatingActionButton, LayerScope, Card, Text } =
    Design

const FiltersHorizontalIcon = getAssetIdByName('FiltersHorizontalIcon', 'png')!
const SettingsIcon = getAssetIdByName('SettingsIcon')!
const PlusLargeIcon = getAssetIdByName('PlusLargeIcon')!

export default function RevengePluginsSettingScreen() {
    return (
        <LayerScope>
            <ClickOutsideProvider>
                <PluginStatesProvider>
                    <Page spacing={16}>
                        <EssentialPluginTooltipProvider>
                            <EnablePluginTooltipProvider>
                                <Screen />
                            </EnablePluginTooltipProvider>
                        </EssentialPluginTooltipProvider>
                    </Page>
                </PluginStatesProvider>
            </ClickOutsideProvider>
        </LayerScope>
    )
}

const SearchDebounceTime = 100

const Filters: FilterAndSortActionSheetProps['filters'] = {
    Enabled: {
        icon: getAssetIdByName('CircleCheckIcon')!,
        filter: plugin => isPluginEnabled(plugin),
    },
    Disabled: {
        icon: getAssetIdByName('CircleXIcon')!,
        filter: plugin => !isPluginEnabled(plugin),
    },
    'Has Errors': {
        icon: getAssetIdByName('CircleErrorIcon')!,
        filter: plugin => plugin.errors.length > 0,
    },
    'Pending Reload': {
        icon: getAssetIdByName('RetryIcon')!,
        filter: plugin => isPluginPendingReload(plugin),
    },
    'Pending Update': {
        icon: getAssetIdByName('RefreshIcon')!,
        filter: plugin => isPluginPendingUpdate(plugin),
    },
    Internal: {
        icon: RevengeIcon,
        desc: 'Included with Revenge.',
        filter: (_, meta) => isPluginInternal(meta),
    },
    Essential: {
        icon: getAssetIdByName('StarIcon')!,
        desc: 'Required for Revenge to function properly.',
        filter: (_, meta) => isPluginEssential(meta),
    },
    'Non-APIs': {
        icon: getAssetIdByName('PaperIcon')!,
        desc: 'Exclude essential plugins that provide APIs for other plugins.',
        filter: (_, meta) => !(meta.iflags & InternalPluginFlags.API),
    },
} satisfies FilterAndSortActionSheetProps['filters']
const DefaultFilters: FilterAndSortActionSheetProps['filter'] = ['Non-APIs']

const DefaultSort: keyof typeof Sorts = 'Name'
const Sorts = {
    Name: [
        getAssetIdByName('IdIcon')!,
        (a, b) => a.manifest.name.localeCompare(b.manifest.name),
    ],
    'Enabled first': [
        getAssetIdByName('CircleCheckIcon')!,
        (a, b) =>
            isPluginEnabled(a) === isPluginEnabled(b)
                ? a.manifest.name.localeCompare(b.manifest.name)
                : isPluginEnabled(a)
                  ? -1
                  : 1,
    ],
} satisfies FilterAndSortActionSheetProps['sorts']

function HeaderButton() {
    const navigation = useNavigation<NavigationProp<any>>()

    return (
        <IconButton
            icon={SettingsIcon}
            onPress={() =>
                navigation.navigate(RouteNames[Setting.RevengePluginsAdvanced])
            }
            variant="tertiary"
        />
    )
}

function BrowseFloatingActionButton() {
    const navigation = useNavigation<NavigationProp<any>>()

    return (
        <FloatingActionButton
            icon={PlusLargeIcon}
            accessibilityLabel="Browse plugins"
            onPress={() =>
                navigation.navigate(RouteNames[Setting.RevengePluginsBrowse])
            }
        />
    )
}

function DefaultsOnlyBanner() {
    const [hide, setHide] = useState(false)

    if (!isDefaultsOnlyBoot || hide) return null

    return (
        <Card>
            <Stack spacing={16}>
                <Text variant="text-sm/medium">
                    Running with default plugins. Your enabled plugins are saved
                    and will come back when you reload.{'\n\n'}
                    Uninstall plugins that might be causing issues, then reload
                    the app to get back on track.
                </Text>
                <Stack spacing={8}>
                    <Design.Button
                        icon={getAssetIdByName('RetryIcon')!}
                        size="sm"
                        text="Reload with all plugins enabled"
                        onPress={() => BundleUpdaterManager.reload()}
                    />
                    {/* In case it's taking too much vertical space */}
                    <Design.Button
                        icon={getAssetIdByName('EyeSlashIcon')!}
                        size="sm"
                        variant="secondary"
                        text="Hide this message"
                        onPress={() => setHide(true)}
                    />
                </Stack>
            </Stack>
        </Card>
    )
}

function snapshotPlugins() {
    return [...pList.values()].map(
        plugin => [plugin, getInternalPluginMeta(plugin)] as const,
    )
}

function Screen() {
    const navigation = useNavigation()
    const route =
        useRoute<
            RouteProp<
                ReactNavigationParamList,
                (typeof RouteNames)[typeof Setting.RevengePlugins]
            >
        >()

    const [search, setSearch] = useState('')
    const debouncedSetSearch = useCallback(
        debounce(setSearch, SearchDebounceTime),
        [],
    )

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => <HeaderButton />,
        })
    }, [navigation])

    const filter = route.params?.filter ?? DefaultFilters
    const matchAll = route.params?.matchAll ?? true
    const reverse = route.params?.reverse ?? false
    const sort = route.params?.sort ?? DefaultSort

    const [allPlugins, setAllPlugins] = useState(snapshotPlugins)

    useEffect(() => {
        const handleUpdate = () => setAllPlugins(snapshotPlugins())

        pEmitter.on('register', handleUpdate)
        pEmitter.on('unregister', handleUpdate)

        return () => {
            pEmitter.off('register', handleUpdate)
            pEmitter.off('unregister', handleUpdate)
        }
    }, [])

    const plugins = useMemo(
        () =>
            allPlugins
                .filter(([plugin, meta]) => {
                    if (filter.length === 0) return true
                    if (matchAll)
                        return filter.every(f =>
                            Filters[f].filter(plugin, meta),
                        )

                    return filter.some(f => Filters[f].filter(plugin, meta))
                })
                .filter(([plugin]) => {
                    const { name, description, author } = plugin.manifest
                    const query = search.toLowerCase()
                    return (
                        name.toLowerCase().includes(query) ||
                        description.toLowerCase().includes(query) ||
                        author.toLowerCase().includes(query)
                    )
                })
                .sort(([a], [b]) => {
                    const result = Sorts[sort as keyof typeof Sorts][1](a, b)
                    return reverse ? -result : result
                }),
        [allPlugins, filter, matchAll, reverse, sort, search],
    )

    return (
        <>
            <DefaultsOnlyBanner />
            <Stack direction="horizontal">
                <View style={styles.grow}>
                    <SearchInput onChange={debouncedSetSearch} size="md" />
                </View>
                <IconButton
                    icon={FiltersHorizontalIcon}
                    variant="tertiary"
                    onPress={() =>
                        ActionSheetActionCreators.openLazy(
                            import('../components/FilterAndSortActionSheet'),
                            'filter-and-sort-plugins',
                            {
                                filters: Filters,
                                filter,
                                setFilter: filter =>
                                    navigation.setParams({ filter }),
                                matchAll,
                                setMatchAll: matchAll =>
                                    navigation.setParams({ matchAll }),
                                reverse,
                                setReverse: reverse =>
                                    navigation.setParams({ reverse }),
                                sorts: Sorts,
                                sort,
                                setSort: sort => navigation.setParams({ sort }),
                            },
                        )
                    }
                />
            </Stack>
            <InstalledPluginMasonryFlashList plugins={plugins} />
            <BrowseFloatingActionButton />
        </>
    )
}
