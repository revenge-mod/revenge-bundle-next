import { styles } from '@revenge-mod/components/_'
import { Design } from '@revenge-mod/discord/design'
import { FlashList } from '@shopify/flash-list'
import { useWindowDimensions } from 'react-native'
import {
    BrowsePluginCard,
    InstalledPluginCard,
    PLUGIN_CARD_HALF_GUTTER,
    PluginCard,
} from './PluginCard'
import { useHidePluginTooltips } from './TooltipProvider'
import type { AnyPlugin, InternalPluginMeta } from '@revenge-mod/plugins/_'
import type { RepoPluginListing } from '@revenge-mod/plugins/_/repositories'
import type { FlashListProps } from '@shopify/flash-list'
import type { PluginRef } from '../utils/repos'
import type { PluginCardProps, PluginInfoData } from './PluginCard'

const { Text } = Design

const gutterCompensation = { margin: -PLUGIN_CARD_HALF_GUTTER }

// TODO: https://github.com/Shopify/flash-list/issues/2050
const MaintainVisibleContentPosition = { disabled: true }

export interface PluginCardData extends PluginInfoData {
    id: string
}

export const pluginCardDataOf = ({ manifest }: AnyPlugin): PluginCardData => ({
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    icon: manifest.icon,
})

/** Overrides for a {@link PluginCard}. */
export type PluginCardExtras = Omit<PluginCardProps, 'info'>

export function PluginFlashList({
    plugins,
    onContentSizeChange,
    contentContainerStyle,
    ListEmptyComponent,
    extrasOf,
}: {
    plugins: PluginCardData[]
    extrasOf?: (plugin: PluginCardData) => PluginCardExtras
} & Pick<
    FlashListProps<PluginCardData>,
    'onContentSizeChange' | 'contentContainerStyle' | 'ListEmptyComponent'
>) {
    const hideTooltips = useHidePluginTooltips()

    return (
        <FlashList
            maintainVisibleContentPosition={MaintainVisibleContentPosition}
            style={gutterCompensation}
            nestedScrollEnabled
            onContentSizeChange={onContentSizeChange}
            contentContainerStyle={contentContainerStyle}
            ListEmptyComponent={ListEmptyComponent}
            data={plugins}
            onScrollBeginDrag={hideTooltips}
            fadingEdgeLength={plugins.length === 1 ? 0 : 16}
            keyExtractor={plugin => plugin.id}
            renderItem={({ item: plugin }) => (
                <PluginCard info={plugin} {...extrasOf?.(plugin)} />
            )}
        />
    )
}

export function InstalledPluginMasonryFlashList({
    ListHeaderComponent,
    plugins,
}: {
    ListHeaderComponent?: React.ComponentType | null
    plugins: (readonly [AnyPlugin, InternalPluginMeta])[]
}) {
    const numColumns = useNumColumns()
    const hideTooltips = useHidePluginTooltips()

    return (
        <FlashList
            maintainVisibleContentPosition={MaintainVisibleContentPosition}
            masonry
            style={gutterCompensation}
            // FAB is 56px tall, plus 16px spacing on top and bottom
            contentContainerStyle={{ paddingBottom: 56 + 2 * 16 }}
            data={plugins}
            onScrollBeginDrag={hideTooltips}
            fadingEdgeLength={16}
            keyExtractor={([plugin]) => plugin.manifest.id}
            numColumns={numColumns}
            ListHeaderComponent={ListHeaderComponent}
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
 * One plugin on the Browse screen, shown from the highest priority repository serving it.
 */
export interface BrowseEntry {
    /** Plugin ID. */
    key: string
    listing: RepoPluginListing
    repoUrl: string
    repoName: string | null
    version: string
    /** The channel the displayed version comes from. */
    channel: string
    size: number
    installed?: readonly [AnyPlugin, InternalPluginMeta]
}

export function BrowsePluginMasonryFlashList({
    entries,
    onInstall,
}: {
    entries: BrowseEntry[]
    onInstall: (id: string, repo: string, ref: PluginRef) => Promise<unknown>
}) {
    const numColumns = useNumColumns()
    const hideTooltips = useHidePluginTooltips()

    return (
        <FlashList
            maintainVisibleContentPosition={MaintainVisibleContentPosition}
            masonry
            style={gutterCompensation}
            contentContainerStyle={{ paddingBottom: 16 }}
            data={entries}
            onScrollBeginDrag={hideTooltips}
            fadingEdgeLength={16}
            keyExtractor={entry => entry.key}
            numColumns={numColumns}
            ListEmptyComponent={NoBrowsePlugins}
            renderItem={({ item: entry }) => {
                if (entry.installed) {
                    const [plugin, meta] = entry.installed
                    return <InstalledPluginCard plugin={plugin} meta={meta} />
                }

                return <BrowsePluginCard entry={entry} onInstall={onInstall} />
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
