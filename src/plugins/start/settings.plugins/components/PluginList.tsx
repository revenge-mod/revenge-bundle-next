import { styles } from '@revenge-mod/components/_'
import { Design } from '@revenge-mod/discord/design'
import { formatVersion } from '@revenge-mod/plugins/utils'
import { FlashList } from '@shopify/flash-list'
import { useWindowDimensions } from 'react-native'
import {
    BrowsePluginCard,
    InstalledPluginCard,
    PLUGIN_CARD_HALF_GUTTER,
    PluginCard,
} from './PluginCard'
import { useResetTooltips } from './TooltipProvider'
import type { AnyPlugin, InternalPluginMeta } from '@revenge-mod/plugins/_'
import type { RepoPluginListing } from '@revenge-mod/plugins/_/repositories'
import type { FlashListProps } from '@shopify/flash-list'

const { Text } = Design

const gutterCompensation = { margin: -PLUGIN_CARD_HALF_GUTTER }

export function PluginFlashList({
    plugins,
    onContentSizeChange,
}: { plugins: AnyPlugin[] } & Pick<
    FlashListProps<AnyPlugin>,
    'onContentSizeChange'
>) {
    const resetTooltips = useResetTooltips()

    return (
        <FlashList
            style={gutterCompensation}
            onContentSizeChange={onContentSizeChange}
            data={plugins}
            onScrollBeginDrag={resetTooltips}
            fadingEdgeLength={plugins.length === 1 ? 0 : 16}
            keyExtractor={plugin => plugin.manifest.id}
            renderItem={({
                item: {
                    manifest: { name, description, version, author, icon },
                },
            }) => (
                <PluginCard
                    name={name}
                    description={description}
                    version={formatVersion(version)}
                    author={author}
                    icon={icon}
                />
            )}
        />
    )
}

export function InstalledPluginMasonryFlashList({
    plugins,
}: {
    plugins: (readonly [AnyPlugin, InternalPluginMeta])[]
}) {
    const numColumns = useNumColumns()
    const resetTooltips = useResetTooltips()

    return (
        <FlashList
            masonry
            style={gutterCompensation}
            // FAB is 56px tall, plus 16px spacing on top and bottom
            contentContainerStyle={{ paddingBottom: 56 + 2 * 16 }}
            data={plugins}
            onScrollBeginDrag={resetTooltips}
            fadingEdgeLength={16}
            keyExtractor={([plugin]) => plugin.manifest.id}
            numColumns={numColumns}
            ListEmptyComponent={NoPlugins}
            renderItem={({ item: [plugin, meta] }) => (
                <InstalledPluginCard plugin={plugin} meta={meta} />
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

function useNumColumns() {
    const { width } = useWindowDimensions()
    const actualWidth = width - styles.pagePadding.paddingHorizontal * 2
    return Math.floor(actualWidth / 448) || 1
}

/**
 * One plugin offered by one repository on the Browse screen.
 * The same ID can appear as separate entries from different repositories.
 */
export interface BrowseEntry {
    /** `repoUrl#id` */
    key: string
    listing: RepoPluginListing
    /** For repository filtering. */
    repoUrl: string
    repoName: string | null
    /** Display text for the Repository row/sheet, eg. `Name (url)`. */
    repositoryText: string
    version: string
    size: number
    installed?: readonly [AnyPlugin, InternalPluginMeta]
}

export function BrowsePluginMasonryFlashList({
    entries,
    onInstall,
}: {
    entries: BrowseEntry[]
    onInstall: (entry: BrowseEntry) => void
}) {
    const numColumns = useNumColumns()
    const resetTooltips = useResetTooltips()

    return (
        <FlashList
            masonry
            style={gutterCompensation}
            contentContainerStyle={{ paddingBottom: 16 }}
            data={entries}
            onScrollBeginDrag={resetTooltips}
            fadingEdgeLength={16}
            keyExtractor={entry => entry.key}
            numColumns={numColumns}
            ListEmptyComponent={NoBrowsePlugins}
            renderItem={({ item: entry }) => {
                if (entry.installed) {
                    const [plugin, meta] = entry.installed
                    return <InstalledPluginCard plugin={plugin} meta={meta} />
                }

                const { listing } = entry
                return (
                    <BrowsePluginCard
                        name={listing.name}
                        description={listing.description}
                        version={entry.version}
                        author={listing.author}
                        icon={listing.icon ?? undefined}
                        id={listing.id}
                        repositoryText={entry.repositoryText}
                        onInstall={() => onInstall(entry)}
                    />
                )
            }}
        />
    )
}

function NoBrowsePlugins() {
    return (
        <Text variant="heading-md/medium" style={{ textAlign: 'center' }}>
            No plugins available. Add repositories to browse plugins.
        </Text>
    )
}
