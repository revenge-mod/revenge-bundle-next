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
import { debounce, noop } from '@revenge-mod/utils/callback'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { BrowsePluginMasonryFlashList } from '../components/PluginList'
import PluginTooltipsProvider from '../components/TooltipProvider'
import { installPluginRef, pickChannel, versionOfChannel } from '../utils/repos'
import type { AnyPlugin, InternalPluginMeta } from '@revenge-mod/plugins/_'
import type { BrowseSortKey } from '../components/BrowseFilterAndSortActionSheet'
import type { BrowseEntry } from '../components/PluginList'
import type { PluginRef, RepoOffer } from '../utils/repos'

const { Stack, IconButton, LayerScope } = Design

const FiltersHorizontalIcon = getAssetIdByName('FiltersHorizontalIcon', 'png')!

const SearchDebounceTime = 100

export default function RevengePluginsBrowseSettingScreen() {
    return (
        <LayerScope>
            <PluginTooltipsProvider>
                <Page spacing={16}>
                    <Screen />
                </Page>
            </PluginTooltipsProvider>
        </LayerScope>
    )
}

/** One plugin and every repository serving it, by priority. */
interface BrowseGroup {
    id: string
    offers: RepoOffer[]
    installed?: readonly [AnyPlugin, InternalPluginMeta]
}

/** Displays `offer`, showing what its default channel points to. */
function toEntry(group: BrowseGroup, offer: RepoOffer): BrowseEntry {
    const { listing } = offer
    const channel = pickChannel(listing)
    const version = versionOfChannel(listing, channel) ?? ''

    return {
        key: group.id,
        listing,
        repoUrl: offer.url,
        repoName: offer.name,
        version,
        channel,
        size: listing.versions[version]?.size ?? 0,
        installed: group.installed,
    }
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
    const [groups, setGroups] = useState<BrowseGroup[]>([])

    // Plugins installed before opening the page, hidden. Fresh installs stay until exit
    const [preinstalled] = useState(() => new Set(pList.keys()))

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
        const repos = (await listRepos()).filter(
            repo => !repo.internal && repo.enabled,
        )

        const listings = await Promise.all(
            repos.map(repo =>
                // No cached index yet is normal, ignore
                listRepoPlugins(repo.url).catch(() => []),
            ),
        )

        // List offers by priority
        const byId = new Map<string, BrowseGroup>()
        repos.forEach((repo, i) => {
            for (const listing of listings[i]!) {
                if (preinstalled.has(listing.id)) continue

                let group = byId.get(listing.id)
                if (!group) {
                    const plugin = pList.get(listing.id)
                    group = {
                        id: listing.id,
                        offers: [],
                        installed: plugin
                            ? [plugin, getInternalPluginMeta(plugin)]
                            : undefined,
                    }
                    byId.set(listing.id, group)
                }

                group.offers.push({ url: repo.url, name: repo.name, listing })
            }
        })

        setGroups([...byId.values()])
    }, [preinstalled])

    useEffect(() => {
        // Show cached indexes right away, then refresh everything
        load()
        refreshAllRepos().then(load, noop)
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
        async (id: string, repo: string, ref: PluginRef) => {
            await installPluginRef(id, repo, ref)
            load()
        },
        [load],
    )

    // Repositories that currently have entries, for the filter sheet
    const repos = useMemo(() => {
        const seen = new Map<string, string | null>()
        for (const group of groups)
            for (const offer of group.offers)
                if (!seen.has(offer.url)) seen.set(offer.url, offer.name)

        return [...seen].map(([url, name]) => ({ url, name }))
    }, [groups])

    const visible = useMemo(() => {
        const query = search.toLowerCase()

        const result = groups.flatMap(group => {
            // The highest priority repository passing the filter
            const offer = group.offers.find(o => !excluded.includes(o.url))
            if (!offer) return []

            const entry = toEntry(group, offer)
            if (!query) return [entry]

            const { name, description, author, id } = entry.listing
            return name.toLowerCase().includes(query) ||
                description.toLowerCase().includes(query) ||
                author.toLowerCase().includes(query) ||
                id.toLowerCase().includes(query)
                ? [entry]
                : []
        })

        result.sort(Sorts[sort])
        if (reverse) result.reverse()

        return result
    }, [groups, excluded, search, sort, reverse])

    return (
        <>
            <Stack direction="horizontal">
                <View style={styles.grow}>
                    <SearchInput
                        onChange={debouncedSetSearch}
                        size="md"
                        clearable
                    />
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
