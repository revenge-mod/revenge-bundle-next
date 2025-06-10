import { getAssetIdByName } from '@revenge-mod/assets'
import FormSwitch from '@revenge-mod/components/FormSwitch'
import Page from '@revenge-mod/components/Page'
import SearchInput from '@revenge-mod/components/SearchInput'
import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import { Tokens } from '@revenge-mod/discord/common'
import { Stores } from '@revenge-mod/discord/common/flux'
import { Design } from '@revenge-mod/discord/design'
import { RootNavigationRef } from '@revenge-mod/discord/modules/main_tabs_v2'
import { FlashList } from '@revenge-mod/externals/shopify'
import {
    _metas,
    _plugins,
    enablePlugin,
    InternalPluginFlags,
    initPlugin,
    preInitPlugin,
    startPlugin,
} from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import { debounce } from '@revenge-mod/utils/callbacks'
import { useReRender } from '@revenge-mod/utils/react'
import { createElement, useCallback, useMemo, useState } from 'react'
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native'
import { RouteNames, Setting } from '../constants'
import type { ReactNavigationParamList } from '@revenge-mod/externals/react-navigation'
import type { InternalPlugin } from '@revenge-mod/plugins/_'
import type { PluginApi } from '@revenge-mod/plugins/types'
import type { FilterAndSortActionSheetProps } from '../components/FilterAndSortActionSheet'

const { Card, Text, Stack, IconButton } = Design

const FilterAndSortActionSheetKey = 'filter-and-sort-plugins'

const Sorts = {
    'Name (A-Z)': (a, b) => a.manifest.name.localeCompare(b.manifest.name),
    'Name (Z-A)': (a, b) => b.manifest.name.localeCompare(a.manifest.name),
    'Enabled first': (a, b) =>
        Number(Boolean(b.flags & PluginFlags.Enabled)) -
        Number(a.flags & PluginFlags.Enabled),
    'Disabled first': (a, b) =>
        Number(a.flags & PluginFlags.Enabled) -
        Number(b.flags & PluginFlags.Enabled),
} as const satisfies FilterAndSortActionSheetProps<string>['sorts']

const DefaultSort: keyof typeof Sorts = 'Name (A-Z)'

export default function RevengePluginsSettingScreen() {
    const [search, setSearch] = useState('')
    const debouncedSetSearch = useCallback(debounce(setSearch, 100), [])
    const [sort, setSort] = useState(DefaultSort)

    const { width } = useWindowDimensions()
    const numColumns = Math.floor((width - 16) / 448)

    const plugins = useMemo(
        () =>
            [..._plugins.values()].map(
                plugin => [plugin, _metas.get(plugin.manifest.id)![2]] as const,
            ),
        [],
    )

    const filteredPlugins = useMemo(
        () =>
            plugins
                .filter(([plugin]) => {
                    const { name, description, author } = plugin.manifest
                    const query = search.toLowerCase()
                    return (
                        name.toLowerCase().includes(query) ||
                        description.toLowerCase().includes(query) ||
                        author.toLowerCase().includes(query)
                    )
                })
                .slice()
                .sort(([a], [b]) => Sorts[sort](a, b)),
        [plugins, search, sort],
    )

    return (
        <Page spacing={16}>
            <Design.Stack direction="horizontal">
                <View style={styles.flex}>
                    <SearchInput
                        onChange={(v: string) => debouncedSetSearch(v)}
                        size="md"
                    />
                </View>
                <IconButton
                    icon={getAssetIdByName('ArrowsUpDownIcon')!}
                    variant="tertiary"
                    onPress={() =>
                        ActionSheetActionCreators.openLazy(
                            import('../components/FilterAndSortActionSheet'),
                            FilterAndSortActionSheetKey,
                            {
                                sorts: Sorts,
                                selectedSort: sort,
                                onSelectSort: key => {
                                    setSort(key as keyof typeof Sorts)
                                    ActionSheetActionCreators.hideActionSheet(
                                        FilterAndSortActionSheetKey,
                                    )
                                },
                            },
                        )
                    }
                />
            </Design.Stack>
            <FlashList.MasonryFlashList
                data={filteredPlugins}
                estimatedItemSize={108}
                numColumns={numColumns}
                renderItem={({ item: [plugin, iflags], columnIndex }) => (
                    <InstalledPluginCard
                        iflags={iflags}
                        key={plugin.manifest.id}
                        plugin={plugin}
                        rightGap={columnIndex + 1 < numColumns}
                    />
                )}
            />
        </Page>
    )
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
})

const usePluginCardStyles = Design.createStyles({
    icon: {
        width: 20,
        height: 20,
        tintColor: Tokens.default.colors.TEXT_NORMAL,
    },
    card: {
        flexGrow: 1,
        marginBottom: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 4,
    },
    rightGap: {
        marginRight: 12,
    },
    topContainer: {
        alignItems: 'center',
    },
    alignedContainer: {
        paddingLeft: 28,
    },
})

function InstalledPluginCard({
    plugin,
    iflags,
    rightGap,
}: {
    plugin: InternalPlugin
    iflags: number
    rightGap?: boolean
}) {
    const {
        manifest: { name, description, author, icon },
        flags,
    } = plugin

    const reRender = useReRender()
    const essential = Boolean(iflags & InternalPluginFlags.Essential)
    const enabled = Boolean(flags & PluginFlags.Enabled)
    const styles_ = usePluginCardStyles()

    return (
        <Card style={[styles_.card, rightGap && styles_.rightGap]}>
            <Stack
                direction="horizontal"
                style={[styles.flex, styles_.topContainer]}
            >
                <Stack
                    direction="horizontal"
                    spacing={8}
                    style={[styles_.topContainer, styles.flex]}
                >
                    <Image
                        source={getAssetIdByName(icon ?? 'PuzzlePieceIcon')!}
                        style={styles_.icon}
                    />
                    <Text variant="heading-lg/semibold">{name}</Text>
                </Stack>
                {plugin.SettingsComponent && (
                    <Design.IconButton
                        size="sm"
                        variant="secondary"
                        icon={getAssetIdByName('SettingsIcon')!}
                        onPress={() => navigatePluginSettings(plugin)}
                    />
                )}
                <FormSwitch
                    disabled={essential}
                    // biome-ignore lint/complexity/useArrowFunction: Async arrows are not supported
                    onValueChange={async function (v) {
                        if (v) {
                            await enablePlugin(plugin, true)
                            await preInitPlugin(plugin)
                            await initPlugin(plugin)
                            await startPlugin(plugin)
                        } else await plugin.disable()

                        reRender()

                        // TODO(plugins/settings): handle sorting after plugin enabled/disabled
                        // make an event based system for this, so we can register a listener for when plugins are disabled or enabled
                        // and sort the list again afterwards

                        // TODO(plugins/settings): show ReloadRequired modal
                        // make an event based system for this, so we can register a listener for when plugins are disabled
                        // and check its flags afterwards
                    }}
                    value={enabled}
                />
            </Stack>
            <Stack spacing={4} style={[styles_.alignedContainer, styles.flex]}>
                <Text
                    color="text-muted"
                    style={styles.flex}
                    variant="heading-md/medium"
                >
                    by {author}
                </Text>
                <Text style={styles.flex} variant="text-md/medium">
                    {description}
                </Text>
            </Stack>
        </Card>
    )
}

// TODO(plugins/settings): Register a custom route instead, so plugin "settings" can actually be pinned and navigated to without hassle.
// This would require us to implement the event-based plugin management system first, so we can listen to plugin enable/disable events and update the settings accordingly.
export function navigatePluginSettings(plugin: InternalPlugin) {
    const [api] = _metas.get(plugin.manifest.id)!
    const navigation =
        RootNavigationRef.getRootNavigationRef<ReactNavigationParamList>()
    if (!navigation.isReady()) return

    navigation.navigate(RouteNames[Setting.RevengeCustomPage], {
        render: () =>
            createElement(plugin.SettingsComponent!, {
                api: api as PluginApi,
            }),
        options: plugin.manifest.icon
            ? {
                  headerTitle: () => (
                      <Design.NavigatorHeader
                          icon={
                              <Image
                                  style={{
                                      width: 24,
                                      height: 24,
                                      marginEnd: 8,
                                      tintColor:
                                          Tokens.default.internal.resolveSemanticColor(
                                              Stores.ThemeStore.theme,
                                              Tokens.default.colors
                                                  .HEADER_PRIMARY,
                                          ),
                                  }}
                                  source={getAssetIdByName(
                                      plugin.manifest.icon!,
                                  )}
                              />
                          }
                          title={plugin.manifest.name}
                      />
                  ),
              }
            : {
                  title: plugin.manifest.name,
              },
    })
}
