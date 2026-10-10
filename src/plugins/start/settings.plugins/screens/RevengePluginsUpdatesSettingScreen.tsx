import { useNavigation } from '@react-navigation/native'
import { getAssetIdByName } from '@revenge-mod/assets'
import { styles } from '@revenge-mod/components/_'
import Checkbox from '@revenge-mod/components/Checkbox'
import Page from '@revenge-mod/components/Page'
import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { Tokens } from '@revenge-mod/discord/common/tokens'
import { Design } from '@revenge-mod/discord/design'
import { reloadApp } from '@revenge-mod/modules/native/app'
import { PluginFlags, pList } from '@revenge-mod/plugins/_'
import { useHasFlagPluginCount } from '@revenge-mod/plugins/_/react'
import { repoEvents } from '@revenge-mod/plugins/_/repositories'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react'
import { Image, View } from 'react-native'
import { useStore } from 'zustand/react'
import { PluginFlashList } from '../components/PluginList'
import RefreshButton from '../components/RefreshButton'
import { showErrorToast } from '../utils/alerts'
import { formatBytes, messageOf, pluralize } from '../utils/strings'
import {
    installSelectedUpdates,
    loadUpdates,
    nameOf,
    toggleUpdate,
    updateNotesOf,
    updateSizeOf,
    updatesStore,
} from '../utils/updates'
import type {
    DownloadProgressEvent,
    PluginUpdate,
} from '@revenge-mod/plugins/_/repositories'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { PluginCardData } from '../components/PluginList'
import type { UpdateNote } from '../utils/updates'

const { Button, FloatingActionButton, Stack, Text, createStyles } = Design

const DownloadIcon = getAssetIdByName('DownloadIcon')!
const WarningIcon = getAssetIdByName('WarningIcon')!
const DownloadIconComponent = lookupGeneratedIconComponent('DownloadIcon')!

// FAB is 56px tall + 16px spacing on top and bottom
const ListPadding = { paddingBottom: 56 + 2 * 16 }

const useStyles = createStyles({
    noteIcon: {
        width: 16,
        height: 16,
        // Matches text-sm line height
        marginTop: 1,
    },
    iconWarning: {
        tintColor: Tokens.default.colors.TEXT_FEEDBACK_WARNING,
    },
})

interface UpdateCardData extends PluginCardData {
    update: PluginUpdate
    notes: UpdateNote[]
}

function UpdateNotes({ notes }: { notes: UpdateNote[] }) {
    const styles_ = useStyles()

    return notes.map(note => (
        <Stack key={note.text} direction="horizontal" spacing={4}>
            {note.warning && (
                <Image
                    source={WarningIcon}
                    style={[styles_.noteIcon, styles_.iconWarning]}
                />
            )}
            <Text
                variant="text-sm/semibold"
                color={note.warning ? 'text-feedback-warning' : 'text-subtle'}
                style={styles.flex}
            >
                {note.text}
            </Text>
        </Stack>
    ))
}

export default function RevengePluginsUpdatesSettingScreen() {
    const navigation = useNavigation()

    const updates = useStore(updatesStore, state => state.updates)
    const repoNames = useStore(updatesStore, state => state.repoNames)
    const selected = useStore(updatesStore, state => state.selected)
    const refreshing = useStore(updatesStore, state => state.checking)
    const busy = useStore(updatesStore, state => state.installing)
    const pendingUpdates = useHasFlagPluginCount(PluginFlags.PendingUpdate)
    const [progress, setProgress] = useState<DownloadProgressEvent | null>(null)

    const load = useCallback((refresh: boolean) => {
        loadUpdates(refresh).catch(e => showErrorToast(messageOf(e)))
    }, [])

    // Cached updates stay until refreshed
    useEffect(() => {
        if (!updatesStore.getState().updates) load(false)
    }, [load])

    useEffect(() => {
        const onProgress = (event: DownloadProgressEvent) => {
            setProgress(event.received >= event.total ? null : event)
        }

        repoEvents.on('downloadProgress', onProgress)
        return () => {
            repoEvents.off('downloadProgress', onProgress)
        }
    }, [])

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <RefreshButton
                    loading={refreshing || busy}
                    onPress={() => load(true)}
                />
            ),
        })
    }, [navigation, load, refreshing, busy])

    const cards = useMemo(
        () =>
            (updates ?? []).map((update): UpdateCardData => {
                const manifest = pList.get(update.id)?.manifest

                return {
                    id: update.id,
                    name: manifest?.name ?? update.id,
                    description: manifest?.description ?? '',
                    notes: updateNotesOf(update, selected),
                    icon: manifest?.icon,
                    version: `v${update.installed} → v${update.available}`,
                    size: formatBytes(updateSizeOf(update)),
                    repository: repoNames[update.repo] || update.repo,
                    update,
                }
            }),
        [updates, selected, repoNames],
    )

    const install = async () => {
        try {
            const { errors, pending } = await installSelectedUpdates()
            if (errors.length)
                showErrorToast(
                    errors
                        .map(e => `${e.id}: ${messageOf(e.error)}`)
                        .join('\n'),
                )
            else
                ToastActionCreators.open('REVENGE_PLUGINS_UPDATED', {
                    text: `Updated ${pluralize(pending.length, 'plugin')}. Reload to apply.`,
                    icon: DownloadIconComponent,
                })
        } catch (e) {
            showErrorToast(messageOf(e))
        } finally {
            setProgress(null)
        }
    }

    if (updates?.length === 0)
        return pendingUpdates ? (
            <EmptyState
                title="Reload to update"
                description={`${pluralize(pendingUpdates, 'plugin update')} will apply after reload.`}
                renderActions={buttonStyle => (
                    <Button
                        variant="primary"
                        size="lg"
                        text="Reload"
                        grow
                        style={buttonStyle}
                        onPress={() => reloadApp()}
                    />
                )}
            />
        ) : (
            <EmptyState
                title="No updates"
                description="Check back later as our developers push more exciting updates!"
                renderActions={buttonStyle => (
                    <>
                        <Button
                            variant="primary"
                            size="lg"
                            text="Refresh"
                            grow
                            loading={refreshing}
                            disabled={refreshing}
                            style={buttonStyle}
                            onPress={() => load(true)}
                        />
                        <Button
                            variant="tertiary"
                            size="lg"
                            text="Go back"
                            grow
                            style={buttonStyle}
                            onPress={() => navigation.goBack()}
                        />
                    </>
                )}
            />
        )

    return (
        <Page spacing={16}>
            <Text variant="text-sm/medium" color="text-subtle">
                {progress
                    ? `Downloading ${nameOf(progress.id)} v${progress.version}: ${formatBytes(progress.received)} / ${formatBytes(progress.total)} (${progress.index} of ${progress.count})`
                    : updates === null
                      ? 'Checking for updates...'
                      : `${selected.size} of ${pluralize(updates.length, 'update')} selected`}
            </Text>
            <PluginFlashList
                plugins={cards}
                contentContainerStyle={ListPadding}
                extrasOf={card => {
                    const { update, notes } = card as UpdateCardData
                    const blocked = Boolean(update.blocker)

                    return {
                        actions: (
                            <Checkbox
                                aria-label={`Update ${card.name}`}
                                checked={selected.has(update.id)}
                                disabled={blocked || busy}
                                onToggle={() => toggleUpdate(update.id)}
                            />
                        ),
                        onPress:
                            blocked || busy
                                ? undefined
                                : () => toggleUpdate(update.id),
                        accessibilityHint: 'Toggles updating this plugin',
                        footer: notes.length > 0 && (
                            <UpdateNotes notes={notes} />
                        ),
                    }
                }}
            />
            <FloatingActionButton
                icon={DownloadIcon}
                accessibilityLabel={`Update ${pluralize(selected.size, 'plugin')}`}
                disabled={busy || refreshing || !selected.size}
                onPress={install}
            />
        </Page>
    )
}

const useEmptyStateStyles = createStyles({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    content: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 16,
        height: '100%',
    },
    text: {
        marginBottom: 16,
        gap: 4,
    },
    centered: {
        textAlign: 'center',
    },
    actions: {
        display: 'flex',
        alignItems: 'center',
        alignSelf: 'stretch',
        gap: 8,
    },
    button: {
        flexGrow: 1,
        alignSelf: 'stretch',
    },
})

function EmptyState({
    title,
    description,
    renderActions,
}: {
    title: string
    description: string
    renderActions: (buttonStyle: StyleProp<ViewStyle>) => ReactNode
}) {
    const styles_ = useEmptyStateStyles()

    return (
        <View style={styles_.container}>
            <View style={styles_.content}>
                <View style={styles_.text}>
                    <Text
                        variant="heading-xl/semibold"
                        accessibilityRole="header"
                        style={styles_.centered}
                    >
                        {title}
                    </Text>
                    <Text
                        variant="text-md/medium"
                        textBreakStrategy="balanced"
                        style={styles_.centered}
                    >
                        {description}
                    </Text>
                </View>
                <View style={styles_.actions}>
                    {renderActions(styles_.button)}
                </View>
            </View>
        </View>
    )
}
