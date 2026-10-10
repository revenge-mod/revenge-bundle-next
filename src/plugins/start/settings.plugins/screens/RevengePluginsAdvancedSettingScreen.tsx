import { useNavigation } from '@react-navigation/native'
import { getAssetIdByName } from '@revenge-mod/assets'
import { FormSwitch } from '@revenge-mod/components'
import { styles } from '@revenge-mod/components/_'
import Page from '@revenge-mod/components/Page'
import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { Tokens } from '@revenge-mod/discord/common/tokens'
import { Design } from '@revenge-mod/discord/design'
import { Clipboard } from '@revenge-mod/externals/react-native-clipboard'
import {
    callPluginSystemMethod,
    getInternalPluginMeta,
    pList,
    resyncPluginSources,
} from '@revenge-mod/plugins/_'
import {
    listRepos,
    refreshRepo,
    repoEvents,
    setRepos,
} from '@revenge-mod/plugins/_/repositories'
import { noop } from '@revenge-mod/utils/callback'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { useCallback, useEffect, useReducer, useState } from 'react'
import { Image, ScrollView, View } from 'react-native'
import { useStore } from 'zustand/react'
import { api } from '..'
import { PluginIcon } from '../components/PluginIcon'
import { RouteNames, Setting } from '../constants'
import { addDefaultRepoIfNeeded, toConfig } from '../repos'
import { showErrorToast, showRemoveRepoConfirmation } from '../utils/alerts'
import { formatBytes, messageOf, pluralize } from '../utils/strings'
import { loadUpdates, nameOf, updatesStore } from '../utils/updates'
import type { NavigationProp } from '@react-navigation/core'
import type {
    DownloadProgressEvent,
    Repo,
    RepoConfigEntry,
    RepoStateEvent,
} from '@revenge-mod/plugins/_/repositories'

const {
    Button,
    ContextMenu,
    IconButton,
    Stack,
    TableRow,
    TableRowGroup,
    TableSwitchRow,
    Text,
    TextInput,
} = Design

const MoreIcon = getAssetIdByName('MoreVerticalIcon')!
const UpIconComponent = lookupGeneratedIconComponent('ArrowSmallUpIcon')!
const DownIconComponent = lookupGeneratedIconComponent('ArrowSmallDownIcon')!
const TrashIconComponent = lookupGeneratedIconComponent('TrashIcon')!

interface UserRepoRowProps {
    repo: Repo
    state?: RepoStateEvent['state']
    onMove: (repo: Repo, delta: number) => void
    onRemove: (repo: Repo) => void
    onToggle: (repo: Repo, enabled: boolean) => void
}

const useRepoRowStyles = Design.createStyles({
    labelText: {
        flexShrink: 1,
    },
    icon: {
        width: 14,
        height: 14,
        tintColor: Tokens.default.colors.TEXT_SUBTLE,
    },
    iconError: {
        tintColor: Tokens.default.colors.TEXT_FEEDBACK_CRITICAL,
    },
})

function UserRepoRow({
    repo,
    state,
    onMove,
    onRemove,
    onToggle,
}: UserRepoRowProps) {
    const styles_ = useRepoRowStyles()

    const menuItems = [
        [
            {
                label: 'Move up',
                IconComponent: UpIconComponent,
                action: () => onMove(repo, -1),
            },
            {
                label: 'Move down',
                IconComponent: DownIconComponent,
                action: () => onMove(repo, 1),
            },
        ],
        [
            {
                label: 'Refresh',
                IconComponent: lookupGeneratedIconComponent('RefreshIcon')!,
                action: () =>
                    refreshRepo(repo.url).catch(e => {
                        showErrorToast(messageOf(e))
                    }),
            },
            {
                label: 'Copy URL',
                IconComponent: lookupGeneratedIconComponent('CopyIcon')!,
                action: () => {
                    Clipboard.setString(repo.url)
                },
            },
            {
                label: 'Remove',
                IconComponent: TrashIconComponent,
                variant: 'destructive' as const,
                action: () =>
                    showRemoveRepoConfirmation(repo, () => onRemove(repo)),
            },
        ],
    ]

    return (
        <TableRow
            icon={
                <PluginIcon
                    size={24}
                    icon={repo.icon || 'GlobeEarthIcon'}
                    defaultIcon={getAssetIdByName('GlobeEarthIcon')}
                />
            }
            label={
                <Stack direction="horizontal" spacing={8}>
                    <Text
                        variant="text-md/medium"
                        color="text-strong"
                        style={styles_.labelText}
                    >
                        {repo.name ?? repo.url}
                    </Text>
                    {state !== 'ready' && state !== undefined && (
                        <Image
                            source={
                                getAssetIdByName(
                                    state === 'error'
                                        ? 'CircleErrorIcon'
                                        : 'RefreshIcon',
                                )!
                            }
                            style={[
                                styles_.icon,
                                state === 'error' && styles_.iconError,
                            ]}
                        />
                    )}
                </Stack>
            }
            subLabel={repo.description || repo.url}
            trailing={
                <Stack
                    direction="horizontal"
                    spacing={8}
                    style={{ alignItems: 'center' }}
                >
                    <ContextMenu
                        items={menuItems}
                        title={repo.name ?? repo.url}
                    >
                        {props => (
                            <IconButton
                                {...props}
                                icon={MoreIcon}
                                size="sm"
                                variant="secondary"
                            />
                        )}
                    </ContextMenu>
                    <FormSwitch
                        value={repo.enabled}
                        onValueChange={enabled => onToggle(repo, enabled)}
                    />
                </Stack>
            }
        />
    )
}

export default function RevengePluginsAdvancedSettingScreen() {
    const navigation = useNavigation<NavigationProp<any>>()
    // Internal repositories are native-managed and not part of the config.
    const [repos, setReposState] = useState<Repo[]>([])
    const [url, setUrl] = useState('')
    const [error, setError] = useState<string | null>(null)
    const busy = useStore(
        updatesStore,
        state => state.checking || state.installing,
    )
    const updates = useStore(updatesStore, state => state.updates)
    const [repoStates, setRepoStates] = useState<
        Record<string, RepoStateEvent['state']>
    >({})
    const [progress, setProgress] = useState<DownloadProgressEvent | null>(null)
    const [n, forceUpdate] = useReducer(x => ~x, 0)

    useEffect(() => {
        const onRepoState = (event: RepoStateEvent) => {
            setRepoStates(states => ({ ...states, [event.url]: event.state }))
        }
        const onProgress = (event: DownloadProgressEvent) => {
            setProgress(event.received >= event.total ? null : event)
        }

        repoEvents.on('repoState', onRepoState)
        repoEvents.on('downloadProgress', onProgress)
        return () => {
            repoEvents.off('repoState', onRepoState)
            repoEvents.off('downloadProgress', onProgress)
        }
    }, [])

    const settings = api.jsonStorage.use()

    const refresh = useCallback(() => {
        listRepos().then(setReposState, e => showErrorToast(messageOf(e)))
    }, [])

    // biome-ignore lint/correctness/useExhaustiveDependencies: forceUpdate so we can refresh the screen
    useEffect(refresh, [refresh, n])

    const commit = useCallback(
        async (config: RepoConfigEntry[]) => {
            try {
                await setRepos(config)
            } catch (e) {
                showErrorToast(messageOf(e))
            }
            refresh()
        },
        [refresh],
    )

    const userRepos = repos.filter(repo => !repo.internal)

    const move = useCallback(
        (repo: Repo, delta: number) => {
            const config = toConfig(userRepos)
            const from = config.findIndex(entry => entry.url === repo.url)
            const to = from + delta
            if (from < 0 || to < 0 || to >= config.length) return
            ;[config[from], config[to]] = [config[to], config[from]]
            commit(config)
        },
        [commit, userRepos],
    )

    const addRepo = useCallback(async () => {
        const added = url.trim()
        await commit([...toConfig(userRepos), { url: added, enabled: true }])
        setUrl('')

        try {
            // Refresh the new repository right away so its plugins show up
            await refreshRepo(added)
        } catch (e) {
            showErrorToast(messageOf(e))
        }
        refresh()
    }, [commit, refresh, url, userRepos])

    const removeRepo = useCallback(
        async (repo: Repo) => {
            await commit(toConfig(userRepos.filter(r => r.url !== repo.url)))

            // Plugins installed from the removed repository turn Sideloaded
            resyncPluginSources().catch(noop)
        },
        [commit, userRepos],
    )

    const toggleRepo = useCallback(
        (repo: Repo, enabled: boolean) => {
            commit(
                toConfig(userRepos).map(entry =>
                    entry.url === repo.url ? { ...entry, enabled } : entry,
                ),
            )
        },
        [commit, userRepos],
    )

    const checkForUpdates = useCallback(async () => {
        setError(null)
        try {
            if (!(await loadUpdates(true)))
                setError('Failed to refresh some repositories...')
        } catch {
            setError('Failed to check for updates...')
        } finally {
            refresh()
        }
    }, [refresh])

    const lastCheckedSubLabel =
        error ||
        (busy
            ? 'Checking for updates...'
            : updates !== null && !updates.length
              ? 'All plugins up to date!'
              : settings?.lastUpdateCheck !== undefined &&
                `Last checked: ${new Date(settings.lastUpdateCheck).toLocaleString()}`)

    const pausedAmount = getPausedAmount()

    return (
        <Page spacing={0}>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.flex}>
                <Stack spacing={16} style={{ paddingBottom: 32 }}>
                    <Stack direction="horizontal" spacing={8}>
                        <View style={styles.grow}>
                            <TextInput
                                label="Repository URL"
                                onChange={setUrl}
                                placeholder="https://example.com/plugins"
                                size="md"
                                value={url}
                            />
                        </View>
                    </Stack>
                    <Button
                        disabled={!url.trim()}
                        onPress={addRepo}
                        text="Add repository"
                        variant="primary"
                    />
                    <TableRowGroup hasIcons title="Repositories">
                        {repos.map(repo =>
                            repo.internal ? (
                                <TableRow
                                    icon={<TableRowAssetIcon name="LockIcon" />}
                                    key={repo.url}
                                    label={repo.name ?? repo.url}
                                    subLabel={repo.description ?? repo.url}
                                />
                            ) : (
                                <UserRepoRow
                                    key={repo.url}
                                    repo={repo}
                                    state={repoStates[repo.url]}
                                    onMove={move}
                                    onRemove={removeRepo}
                                    onToggle={toggleRepo}
                                />
                            ),
                        )}
                    </TableRowGroup>
                    <TableRowGroup
                        title="Updates"
                        description={
                            pausedAmount
                                ? `Updates are paused for ${pluralize(pausedAmount, 'plugin')}.`
                                : undefined
                        }
                    >
                        <TableSwitchRow
                            label="Update plugins automatically"
                            subLabel="Check repositories and apply plugin updates after startup."
                            onValueChange={autoUpdate => {
                                api.jsonStorage.set({ autoUpdate })
                            }}
                            value={settings?.autoUpdate ?? true}
                        />
                        <TableSwitchRow
                            label="Skip on metered networks"
                            subLabel="Skip automatic updates on metered connections."
                            disabled={!(settings?.autoUpdate ?? true)}
                            onValueChange={skipUpdatesOnExpensiveNetwork => {
                                api.jsonStorage.set({
                                    skipUpdatesOnExpensiveNetwork,
                                })
                            }}
                            value={
                                settings?.skipUpdatesOnExpensiveNetwork ?? false
                            }
                        />
                        <TableRow
                            icon={<TableRowAssetIcon name="RefreshIcon" />}
                            label="Check for updates"
                            subLabel={lastCheckedSubLabel}
                            disabled={busy || !userRepos.length}
                            onPress={checkForUpdates}
                        />
                        {progress ? (
                            <TableRow
                                icon={<TableRowAssetIcon name="<EMPTY>" />}
                                label={`Downloading ${nameOf(progress.id)} ${progress.version}`}
                                subLabel={`${formatBytes(progress.received)} / ${formatBytes(progress.total)} (${progress.index} of ${progress.count})`}
                            />
                        ) : null}
                        {updates?.length ? (
                            <TableRow
                                icon={<TableRowAssetIcon name="DownloadIcon" />}
                                label="View updates"
                                subLabel={`${pluralize(updates.length, 'update')} available`}
                                arrow
                                disabled={busy}
                                onPress={() =>
                                    navigation.navigate(
                                        RouteNames[
                                            Setting.RevengePluginsUpdates
                                        ],
                                    )
                                }
                            />
                        ) : null}
                    </TableRowGroup>
                    <TableRowGroup hasIcons title="Advanced">
                        <TableRow
                            icon={<TableRowAssetIcon name="DownloadIcon" />}
                            label="Install from file"
                            onPress={() =>
                                callPluginSystemMethod(
                                    'revenge.plugins.installFile',
                                    [],
                                ).catch(e => showErrorToast(messageOf(e)))
                            }
                        />
                        <TableRow
                            icon={<TableRowAssetIcon name="GlobeEarthIcon" />}
                            label="Restore default repository"
                            onPress={async () => {
                                try {
                                    const restored =
                                        await addDefaultRepoIfNeeded(true)
                                    if (!restored) {
                                            ToastActionCreators.open(
                                                'REVENGE_DEFAULT_REPO_NO_ACTION',
                                                {
                                                    text: 'Nothing to restore',
                                                    icon: lookupGeneratedIconComponent(
                                                        'FileWarningIcon',
                                                    ),
                                                },
                                            )

                                        return
                                    }

                                    forceUpdate()
                                } catch (e) {
                                    showErrorToast(messageOf(e))
                                }
                            }}
                        />
                    </TableRowGroup>
                </Stack>
            </ScrollView>
        </Page>
    )
}

function getPausedAmount() {
    return [...pList.values()].filter(
        p => getInternalPluginMeta(p).source?.held,
    ).length
}
