import { SheetHeader } from '@revenge-mod/components'
import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { BottomSheet as Gorhom } from '@revenge-mod/externals/gorhom'
import { ReactNativeSafeAreaContext } from '@revenge-mod/externals/react-native-safe-area-context'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import { findRepoListing, messageOf, showErrorToast } from '../utils/repos'
import { ChannelRadioGroup, VersionRadioGroup } from './PluginSourceRadioGroups'
import RefreshButton from './RefreshButton'
import type { RepoPluginListing } from '@revenge-mod/plugins/_/repositories'
import type { ReactNode } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import type { PluginRef } from '../utils/repos'

const {
    BottomSheet,
    SegmentedControlPages,
    Tabs,
    Text,
    createStyles,
    useSegmentedControlState,
} = Design

export interface PluginRefPickerActionSheetProps {
    id: string
    /** Repository URL to list from. */
    repo: string
    /** Selected channel or version. */
    pluginRef: PluginRef
    /** Resolves `true` to select the picked ref. */
    onSelect: (ref: PluginRef) => Promise<boolean> | boolean
}

/** Tab indices. */
const ChannelsTab = 0
const VersionsTab = 1

export default function PluginRefPickerActionSheet({
    id,
    repo,
    pluginRef,
    onSelect,
}: PluginRefPickerActionSheetProps) {
    const [selected, setSelected] = useState(pluginRef)
    const [listing, setListing] = useState<RepoPluginListing | null>()
    const [loading, setLoading] = useState(false)
    const busy = useRef(false)
    const [pageWidth, setPageWidth] = useState(0)

    const load = useCallback(
        async (refresh: boolean) => {
            setLoading(true)
            try {
                setListing((await findRepoListing(repo, id, refresh)) ?? null)
            } catch (e) {
                showErrorToast(messageOf(e))
                if (!refresh) setListing(null)
            } finally {
                setLoading(false)
            }
        },
        [repo, id],
    )

    useEffect(() => {
        load(false)
    }, [load])

    const onLayout = useCallback(
        (e: LayoutChangeEvent) => setPageWidth(e.nativeEvent.layout.width),
        [],
    )

    const items = useMemo(() => {
        if (!listing) return []

        const select = (ref: PluginRef) => {
            if (busy.current) return

            busy.current = true
            Promise.resolve(onSelect(ref))
                .then(picked => {
                    if (picked) setSelected(ref)
                })
                .finally(() => {
                    busy.current = false
                })
        }

        const channels = Object.keys(listing.channels)
        const versions = Object.keys(listing.versions)

        return [
            {
                id: 'channels',
                label: 'Channels',
                count: channels.length,
                page: (
                    <RefPage empty="No channels in this repository.">
                        {channels.length > 0 && (
                            <ChannelRadioGroup
                                listing={listing}
                                value={
                                    selected.type === 'channel'
                                        ? selected.channel
                                        : null
                                }
                                onChange={channel =>
                                    select({ type: 'channel', channel })
                                }
                            />
                        )}
                    </RefPage>
                ),
            },
            {
                id: 'versions',
                label: 'Versions',
                count: versions.length,
                page: (
                    <RefPage empty="No versions in this repository.">
                        {versions.length > 0 && (
                            <VersionRadioGroup
                                listing={listing}
                                value={
                                    selected.type === 'version'
                                        ? selected.version
                                        : null
                                }
                                onChange={version =>
                                    select({ type: 'version', version })
                                }
                            />
                        )}
                    </RefPage>
                ),
            },
        ]
    }, [listing, selected, onSelect])

    const state = useSegmentedControlState({
        items,
        pageWidth,
        defaultIndex: selected.type === 'version' ? VersionsTab : ChannelsTab,
    })
    const styles_ = useStyles()

    return (
        <BottomSheet
            scrollable
            header={
                <SheetHeader
                    title="Select a channel or version"
                    action={
                        <RefreshButton
                            loading={loading}
                            onPress={() => load(true)}
                        />
                    }
                />
            }
        >
            {items.length ? (
                <View style={styles_.body} onLayout={onLayout}>
                    <View>
                        <Tabs state={state} />
                    </View>
                    <SegmentedControlPages state={state} />
                </View>
            ) : (
                listing === null && (
                    <RefPage empty="This repository no longer serves this plugin." />
                )
            )}
        </BottomSheet>
    )
}

function RefPage({ children, empty }: { children?: ReactNode; empty: string }) {
    const styles_ = useStyles()
    const { bottom } = ReactNativeSafeAreaContext.useSafeAreaInsets()

    return (
        <Gorhom.BottomSheetScrollView
            style={styles_.page}
            contentContainerStyle={[
                styles_.pageContent,
                { paddingBottom: 16 + bottom },
            ]}
        >
            {children || (
                <Text variant="text-md/medium" color="text-muted">
                    {empty}
                </Text>
            )}
        </Gorhom.BottomSheetScrollView>
    )
}

const useStyles = createStyles({
    body: {
        flex: 1,
        gap: 20,
        paddingTop: 8,
    },
    page: {
        flex: 1,
    },
    pageContent: {
        marginHorizontal: 16,
    },
})

export function openPluginRefPickerActionSheet(
    props: PluginRefPickerActionSheetProps,
) {
    ActionSheetActionCreators.openLazy(
        Promise.resolve({ default: PluginRefPickerActionSheet }),
        'REVENGE_PLUGIN_REF_PICKER',
        props,
        'stack',
    )
}
