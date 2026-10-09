import { TableRowAssetIcon } from '@revenge-mod/components'
import { Design } from '@revenge-mod/discord/design'
import { ReactNativeSafeAreaContext } from '@revenge-mod/externals/react-native-safe-area-context'
import { parsePluginContributor } from '@revenge-mod/plugins/utils'
import { useCallback, useMemo, useState } from 'react'
import { View } from 'react-native'
import { openLink, openUserProfile } from '../utils/contacts'
import type { PluginContributor } from '@revenge-mod/plugins/utils'
import type { LayoutChangeEvent } from 'react-native'

const {
    BottomSheet,
    SegmentedControlPages,
    TableRow,
    TableRowGroup,
    Tabs,
    Text,
    createStyles,
    useSegmentedControlState,
} = Design

/** Most Discord IDs and links shown per contributor. */
const MaxShownEntries = 5

/** Most tabs splitting the bar width evenly before it scrolls instead. */
const MaxGrowingTabs = 3

export interface PluginContributorsActionSheetProps {
    pluginName: string
    author: string
    contributors: string[]
}

export default function PluginContributorsActionSheet({
    pluginName,
    author,
    contributors,
}: PluginContributorsActionSheetProps) {
    const [pageWidth, setPageWidth] = useState(0)

    const onLayout = useCallback(
        (e: LayoutChangeEvent) => setPageWidth(e.nativeEvent.layout.width),
        [],
    )

    const items = useMemo(
        () =>
            [author, ...contributors].map((raw, i) => {
                const contributor = parsePluginContributor(raw) ?? {
                    name: raw,
                    ids: [],
                    links: [],
                }

                return {
                    id: String(i),
                    label: contributor.name,
                    page: <ContributorEntries contributor={contributor} />,
                }
            }),
        [author, contributors],
    )

    const state = useSegmentedControlState({ items, pageWidth })
    const styles_ = useStyles()

    if (items.length === 1) {
        const [item] = items

        return (
            <BottomSheet
                scrollable
                header={<ContributorsSheetTitle title={item!.label} />}
            >
                <View style={styles_.body}>{item!.page}</View>
            </BottomSheet>
        )
    }

    return (
        <BottomSheet
            scrollable
            header={
                <ContributorsSheetTitle
                    title={`Contributors of ${pluginName}`}
                />
            }
        >
            <View style={styles_.body} onLayout={onLayout}>
                <View>
                    <Tabs state={state} grow={items.length <= MaxGrowingTabs} />
                </View>
                <SegmentedControlPages state={state} />
            </View>
        </BottomSheet>
    )
}

function ContributorsSheetTitle({ title }: { title: string }) {
    const styles_ = useStyles()

    return (
        <View style={styles_.header}>
            <Text
                variant="redesign/heading-18/bold"
                color="mobile-text-heading-primary"
                accessibilityRole="header"
            >
                {title}
            </Text>
        </View>
    )
}

function ContributorEntries({
    contributor,
}: {
    contributor: PluginContributor
}) {
    const styles_ = useStyles()
    const { bottom } = ReactNativeSafeAreaContext.useSafeAreaInsets()

    const ids = [...new Set(contributor.ids)].slice(0, MaxShownEntries)
    const links = Array.from(
        new Map(contributor.links.map(link => [link.url, link])).values(),
    ).slice(0, MaxShownEntries)

    return (
        <View style={[styles_.page, { paddingBottom: 16 + bottom }]}>
            {ids.length || links.length ? (
                <ContributorEntryRows
                    name={contributor.name}
                    ids={ids}
                    links={links}
                />
            ) : (
                <Text variant="text-md/medium" color="text-muted">
                    No contact information.
                </Text>
            )}
        </View>
    )
}

function ContributorEntryRows({
    name,
    ids,
    links,
}: {
    name: string
    ids: string[]
    links: PluginContributor['links']
}) {
    return (
        <TableRowGroup hasIcons title={`Contacts for ${name}`}>
            {ids.map(id => (
                <TableRow
                    key={id}
                    icon={<TableRowAssetIcon name="ClydeIcon" />}
                    label="Discord"
                    subLabel={id}
                    arrow
                    onPress={() => openUserProfile(id)}
                />
            ))}
            {links.map(({ url, label }) => (
                <TableRow
                    key={url}
                    icon={<TableRowAssetIcon name="LinkIcon" />}
                    label={label ?? formatLink(url)}
                    subLabel={label ? formatLink(url) : undefined}
                    arrow
                    onPress={() => openLink(url)}
                />
            ))}
        </TableRowGroup>
    )
}

/** Strips the scheme and trailing slash for display. */
const formatLink = (link: string) =>
    link.replace(/^(?:https?:\/\/|mailto:)/i, '').replace(/\/$/, '')

const useStyles = createStyles({
    header: {
        flexDirection: 'row',
        marginHorizontal: 16,
        justifyContent: 'center',
    },
    body: {
        flex: 1,
        gap: 20,
        paddingTop: 8,
    },
    page: {
        flex: 1,
        marginHorizontal: 16,
    },
})
