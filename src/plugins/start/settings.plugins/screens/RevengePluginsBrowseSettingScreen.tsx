import { getAssetIdByName } from '@revenge-mod/assets'
import { styles } from '@revenge-mod/components/_'
import Page from '@revenge-mod/components/Page'
import SearchInput from '@revenge-mod/components/SearchInput'
import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { getInternalPluginMeta, pEmitter, pList } from '@revenge-mod/plugins/_'
import {
    listRepoPlugins,
    listRepos,
    refreshAllRepos,
} from '@revenge-mod/plugins/_/repositories'
import { debounce } from '@revenge-mod/utils/callback'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { ClickOutsideProvider } from 'react-native-click-outside'
import { BrowsePluginMasonryFlashList } from '../components/PluginList'
import PluginStatesProvider from '../components/PluginStateProvider'
import {
    EnablePluginTooltipProvider,
    EssentialPluginTooltipProvider,
} from '../components/TooltipProvider'
import { runInstallFlow } from '../utils/repos'
import type { RepoPluginListing } from '@revenge-mod/plugins/_/repositories'
import type { BrowseSortKey } from '../components/BrowseFilterAndSortActionSheet'
import type { BrowseEntry } from '../components/PluginList'

const { Stack, IconButton, LayerScope } = Design

const FiltersHorizontalIcon = getAssetIdByName('FiltersHorizontalIcon', 'png')!

const SearchDebounceTime = 100

export default function RevengePluginsBrowseSettingScreen() {
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

/** The channel a listing displays: preferred, `latest`, else its first channel. */
function displayChannelOf(listing: RepoPluginListing, preferredChannel: string): string | undefined {
    if (preferredChannel && listing.channels[preferredChannel]) return preferredChannel
    if (listing.channels.latest) return 'latest'
    return Object.keys(listing.channels)[0]
}

function compareNames(a: BrowseEntry, b: BrowseEntry) {
    return a.listing.name.localeCompare(b.listing.name, undefined, {
        sensitivity: 'base',
    })
}

const Sorts: Record<BrowseSortKey, (a: BrowseEntry, b: BrowseEntry) => number> =
    {
        name: compareNames,
        size: (a, b) => a.size - b.size || compareNames(a, b),
    }

function Screen() {
    const [entries, setEntries] = useState<BrowseEntry[]>([])
    const [internalRepos, setInternalRepos] = useState<string[]>([])

    const [search, setSearch] = useState('')
    const debouncedSetSearch = useCallback(
        debounce(setSearch, SearchDebounceTime),
        [],
    )

    // Unchecked repository URLs, so repos that appear later default to checked
    const [excluded, setExcluded] = useState<string[]>([])
    const [sort, setSort] = useState<BrowseSortKey>('name')
    const [reverse, setReverse] = useState(false)

    const hasFilter = useMemo(
        () => excluded.length > 0 || sort !== 'name' || reverse,
        [excluded, sort, reverse],
    )

    const load = useCallback(async () => {
        const repos = await listRepos()
        const all: BrowseEntry[] = []

        setInternalRepos(
            repos.filter(repo => repo.internal).map(repo => repo.url),
        )

        await Promise.all(
            repos
                .filter(repo => !repo.internal && repo.enabled)
                .map(repo =>
                    listRepoPlugins(repo.url).then(
                        listings => {
                            const repositoryText = repo.name
                                ? `${repo.name} (${repo.url})`
                                : repo.url

                            for (const listing of listings) {
                                const plugin = pList.get(listing.id)
                                const displayChannel = displayChannelOf(listing, '')
                                const displayVersion = displayChannel
                                    ? (listing.channels[displayChannel] ?? '')
                                    : ''
                                all.push({
                                    key: `${repo.url}#${listing.id}`,
                                    listing,
                                    repoUrl: repo.url,
                                    repoName: repo.name ?? null,
                                    repositoryText,
                                    version: displayVersion,
                                    channel: displayChannel,
                                    size:
                                        listing.versions[displayVersion]
                                            ?.size ?? 0,
                                    installed: plugin
                                        ? ([
                                              plugin,
                                              getInternalPluginMeta(plugin),
                                          ] as const)
                                        : undefined,
                                })
                            }
                        },
                        // No cached index yet is normal, ignore
                        () => {},
                    ),
                ),
        )

        setEntries(all)
    }, [])

    useEffect(() => {
        // Show cached indexes right away, then refresh everything
        load()
        refreshAllRepos().then(load, () => {})
    }, [load])

    // Fresh installs register live, re-mark entries as installed when they do
    useEffect(() => {
        const handleUpdate = () => load()

        pEmitter.on('register', handleUpdate)
        pEmitter.on('unregister', handleUpdate)

        return () => {
            pEmitter.off('register', handleUpdate)
            pEmitter.off('unregister', handleUpdate)
        }
    }, [load])

    const install = useCallback(
        async (
            entry: BrowseEntry,
            channel?: string,
            version?: string,
        ) => {
            const targetChannel = channel || entry.channel
            const targetVersion =
                version ||
                (targetChannel
                    ? (entry.listing.channels[targetChannel] ?? '')
                    : '') ||
                entry.version

            // Pin the displayed version, channel, and repository, so the plan matches the card
            await runInstallFlow(
                entry.listing.id,
                targetVersion || undefined,
                targetChannel,
                // Internal repos so external plugins can link against internal plugins as well
                [...internalRepos, entry.repoUrl],
            )
            load()
        },
        [internalRepos, load],
    )

    // Repositories that currently have entries, for the filter sheet
    const repos = useMemo(() => {
        const seen = new Map<string, string | null>()
        for (const entry of entries)
            if (!seen.has(entry.repoUrl))
                seen.set(entry.repoUrl, entry.repoName)

        return [...seen].map(([url, name]) => ({ url, name }))
    }, [entries])

    const visible = useMemo(() => {
        const query = search.toLowerCase()

        const result = entries.filter(entry => {
            if (excluded.includes(entry.repoUrl)) return false
            if (!query) return true

            const { name, description, author, id } = entry.listing
            return (
                name.toLowerCase().includes(query) ||
                description.toLowerCase().includes(query) ||
                author.toLowerCase().includes(query) ||
                id.toLowerCase().includes(query)
            )
        })

        result.sort(Sorts[sort])
        if (reverse) result.reverse()

        return result
    }, [entries, excluded, search, sort, reverse])

    return (
        <>
            <Stack direction="horizontal">
                <View style={styles.grow}>
                    <SearchInput onChange={debouncedSetSearch} size="md" />
                </View>
                <IconButton
                    icon={FiltersHorizontalIcon}
                    variant={hasFilter ? 'primary' : 'tertiary'}
                    onPress={() =>
                        ActionSheetActionCreators.openLazy(
                            import(
                                '../components/BrowseFilterAndSortActionSheet'
                            ),
                            'browse-filter-and-sort',
                            {
                                repos,
                                checked: repos
                                    .map(repo => repo.url)
                                    .filter(url => !excluded.includes(url)),
                                setChecked: (urls: string[]) =>
                                    setExcluded(
                                        repos
                                            .map(repo => repo.url)
                                            .filter(url => !urls.includes(url)),
                                    ),
                                sort,
                                setSort,
                                reverse,
                                setReverse,
                            },
                        )
                    }
                />
            </Stack>
            <BrowsePluginMasonryFlashList
                entries={visible}
                onInstall={install}
            />
        </>
    )
}
