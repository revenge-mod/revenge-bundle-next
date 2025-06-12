import { getAssetIdByName } from '@revenge-mod/assets'
import { styles } from '@revenge-mod/components/_'
import Page from '@revenge-mod/components/Page'
import SearchInput from '@revenge-mod/components/SearchInput'
import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { ReactNavigationNative } from '@revenge-mod/externals/react-navigation'
import { FlashList } from '@revenge-mod/externals/shopify'
import { _metas, _plugins, InternalPluginFlags } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import { debounce } from '@revenge-mod/utils/callbacks'
import { useCallback, useMemo, useState } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { ClickOutsideProvider } from 'react-native-click-outside'
import RevengeIcon from '~assets/RevengeIcon'
import { InstalledPluginCard } from '../components/PluginCard'
import {
    EnablePluginTooltipProvider,
    EssentialPluginTooltipProvider,
    resetTooltips,
} from '../components/TooltipProvider'
import type { RouteProp } from '@react-navigation/core'
import type { ReactNavigationParamList } from '@revenge-mod/externals/react-navigation'
import type { InternalPlugin } from '@revenge-mod/plugins/_'
import type { FilterAndSortActionSheetProps } from '../components/FilterAndSortActionSheet'
import type { RouteNames, Setting } from '../constants'

const { Text, Stack, IconButton, LayerScope } = Design

const FiltersHorizontalIcon = getAssetIdByName('FiltersHorizontalIcon', 'png')!

export default function RevengePluginsSettingScreen() {
    return (
        <LayerScope>
            <ClickOutsideProvider>
                <Page spacing={16}>
                    <EssentialPluginTooltipProvider>
                        <EnablePluginTooltipProvider>
                            <Screen />
                        </EnablePluginTooltipProvider>
                    </EssentialPluginTooltipProvider>
                </Page>
            </ClickOutsideProvider>
        </LayerScope>
    )
}

const SearchDebounceTime = 100

const Filters: FilterAndSortActionSheetProps['filters'] = {
    Enabled: [
        getAssetIdByName('CircleCheckIcon')!,
        plugin => Boolean(plugin.flags & PluginFlags.Enabled),
    ],
    Disabled: [
        getAssetIdByName('CircleXIcon')!,
        plugin => !(plugin.flags & PluginFlags.Enabled),
    ],
    Internal: [
        RevengeIcon,
        plugin => Boolean(plugin.flags & InternalPluginFlags.Internal),
    ],
    Essential: [
        getAssetIdByName('StarIcon')!,
        (_, iflags) => Boolean(iflags & InternalPluginFlags.Essential),
    ],
} satisfies FilterAndSortActionSheetProps['filters']
const DefaultFilters: FilterAndSortActionSheetProps['filter'] = []

const DefaultSort: keyof typeof Sorts = 'Name'
const Sorts = {
    Name: [
        getAssetIdByName('IdIcon')!,
        (a, b) => a.manifest.name.localeCompare(b.manifest.name),
    ],
    'Enabled first': [
        getAssetIdByName('CircleCheckIcon')!,
        (a, b) =>
            (b.flags & PluginFlags.Enabled) - (a.flags & PluginFlags.Enabled),
    ],
} satisfies FilterAndSortActionSheetProps['sorts']

function Screen() {
    const navigation = ReactNavigationNative.useNavigation()
    const route =
        ReactNavigationNative.useRoute<
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

    const [filter, setFilter] = useState(route.params?.filter ?? DefaultFilters)
    const [matchAll, setMatchAll] = useState(route.params?.matchAll ?? false)

    const [reverse, setReverse] = useState(route.params?.reverse ?? false)
    const [sort, setSort] = useState(route.params?.sort ?? DefaultSort)

    const allPlugins = useMemo(
        () =>
            [..._plugins.values()].map(
                plugin => [plugin, _metas.get(plugin.manifest.id)![2]] as const,
            ),
        [sortFn],
    )

    const plugins = useMemo(
        () =>
            allPlugins
                .filter(([plugin, iflags]) => {
                    if (filter.length === 0) return true
                    if (matchAll)
                        return filter.every(f => Filters[f][1](plugin, iflags))

                    return filter.some(f => Filters[f][1](plugin, iflags))
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
                    if (reverse) return -result
                    return result
                }),
        [search, sort, reverse, filter, matchAll, allPlugins],
    )

    const style = useHeaderStyles()
    return (
        <>
            <Stack direction="horizontal">
                <View style={styles.grow}>
                    <SearchInput
                        onChange={(v: string) => debouncedSetSearch(v)}
                        size="md"
                    />
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
                                setFilter: filter => {
                                    navigation.setParams({ filter })
                                    setFilter(filter)
                                },
                                matchAll,
                                setMatchAll: matchAll => {
                                    navigation.setParams({ matchAll })
                                    setMatchAll(matchAll)
                                },
                                reverse,
                                setReverse: reverse => {
                                    navigation.setParams({ reverse })
                                    setReverse(reverse)
                                },
                                sorts: Sorts,
                                sort,
                                setSort: sort => {
                                    navigation.setParams({ sort })
                                    setSort(sort)
                                },
                            },
                        )
                    }
                />
            </Stack>
            <PluginMasonryFlashList plugins={plugins} />
        </>
    )
}

function PluginMasonryFlashList({
    plugins,
}: {
    plugins: (readonly [InternalPlugin, number])[]
}) {
    const { width, height } = useWindowDimensions()
    const numColumns = Math.floor((width - 16) / 448)

    return (
        <FlashList.MasonryFlashList
            data={plugins}
            onScrollBeginDrag={resetTooltips}
            fadingEdgeLength={16}
            keyExtractor={([plugin]) => plugin.manifest.id}
            estimatedListSize={{ width: width - 32, height: height - 160 }}
            estimatedItemSize={116}
            numColumns={numColumns}
            ListEmptyComponent={NoPlugins}
            renderItem={({ item: [plugin, iflags], columnIndex }) => (
                <InstalledPluginCard
                    iflags={iflags}
                    key={plugin.manifest.id}
                    plugin={plugin}
                    rightGap={columnIndex + 1 < numColumns}
                />
            )}
        />
    )
}

function NoPlugins() {
    return (
        <Text variant="heading-md/medium" style={{ textAlign: 'center' }}>
            No plugins found. Try changing your query or filters.
        </Text>
    )
}
