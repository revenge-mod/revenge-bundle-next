import { getAssetIdByName } from '@revenge-mod/assets'
import FormSwitch from '@revenge-mod/components/FormSwitch'
import Page from '@revenge-mod/components/Page'
import SearchInput from '@revenge-mod/components/SearchInput'
import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import { Tokens } from '@revenge-mod/discord/common'
import { Design } from '@revenge-mod/discord/design'
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
import { useCallback, useMemo, useState } from 'react'
import { Image, useWindowDimensions, View } from 'react-native'
import type { InternalPlugin } from '@revenge-mod/plugins/_'
import type { Plugin } from '@revenge-mod/plugins/types'

const { Card, Text, Stack, IconButton } = Design

const ACTION_KEY = 'sort-key'

const sortOptions: Record<string, (a: Plugin[], b: Plugin[]) => number> = {
    'Name (A-Z)': (a, b) =>
        a[0].manifest.name.localeCompare(b[0].manifest.name),
    'Name (Z-A)': (a, b) =>
        b[0].manifest.name.localeCompare(a[0].manifest.name),
    Enabled: (a, b) =>
        Number(Boolean(b[0].flags & PluginFlags.Enabled)) -
        Number(a[0].flags & PluginFlags.Enabled),
    Disabled: (a, b) =>
        Number(a[0].flags & PluginFlags.Enabled) -
        Number(b[0].flags & PluginFlags.Enabled),
}

export default function RevengePluginsSettingScreen() {
    const [search, setSearch] = useState('')
    const debouncedSetSearch = useCallback(debounce(setSearch, 100), [])
    const [sortFn, setSortFn] = useState<(a: any, b: any) => number>(
        () => sortOptions['Name (A-Z)'],
    )

    const { width } = useWindowDimensions()
    const numColumns = Math.floor((width - 16) / 448)

    const plugins = useMemo(
        () =>
            [..._plugins.values()].map(
                plugin => [plugin, _metas.get(plugin.manifest.id)![2]] as const,
            ),
        [sortFn],
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
                .sort(sortFn),
        [plugins, search],
    )

    const style = useHeaderStyles()
    return (
        <Page spacing={16}>
            <Design.Stack direction="horizontal">
                <View style={style.searchBar}>
                    <SearchInput
                        onChange={(v: string) => debouncedSetSearch(v)}
                        size="md"
                    />
                </View>
                <View style={style.icon}>
                    <IconButton
                        icon={
                            getAssetIdByName(
                                'ic_forum_channel_sort_order_24px',
                            )!
                        }
                        variant="tertiary"
                        disabled={!!search}
                        onPress={() =>
                            ActionSheetActionCreators.openLazy(
                                import('../components/SortActionSheet'),
                                ACTION_KEY,
                                {
                                    sortOptions,
                                    onSelectSort: (fn: string) => {
                                        setSortFn(() => sortOptions[fn])
                                        ActionSheetActionCreators.hideActionSheet(
                                            ACTION_KEY,
                                        )
                                    },
                                },
                            )
                        }
                    />
                </View>
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
    grow: {
        flexGrow: 1,
    },
    autoSize: {
        flex: 1,
    },
})
const useHeaderStyles = Design.createStyles({
    icon: {
        flex: 1,
        justifyContent: 'center',
    },
    searchBar: {
        flex: 6,
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
    const styles = usePluginCardStyles()

    return (
        <Card style={[styles.card, rightGap && styles.rightGap]}>
            <Stack
                direction="horizontal"
                style={[styles.grow, styles.topContainer]}
            >
                <Stack
                    direction="horizontal"
                    spacing={8}
                    style={[styles.topContainer, styles.autoSize]}
                >
                    <Image
                        source={getAssetIdByName(icon ?? 'PuzzlePieceIcon')!}
                        style={styles.icon}
                    />
                    <Text variant="heading-lg/semibold">{name}</Text>
                </Stack>
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
            <Stack spacing={4} style={[styles.alignedContainer, styles.grow]}>
                <Text
                    color="text-muted"
                    style={styles.grow}
                    variant="heading-md/medium"
                >
                    by {author}
                </Text>
                <Text style={styles.grow} variant="text-md/medium">
                    {description}
                </Text>
            </Stack>
        </Card>
    )
}
