import { getAssetIdByName } from '@revenge-mod/assets'
import { FormSwitch } from '@revenge-mod/components'
import { styles } from '@revenge-mod/components/_'
import Page from '@revenge-mod/components/Page'
import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { Clipboard } from '@revenge-mod/externals/react-native-clipboard'
import { callNativeMethod } from '@revenge-mod/modules/native'
import { resyncPluginSources } from '@revenge-mod/plugins/_'
import {
    listAllUpdates,
    listRepos,
    refreshAllRepos,
    refreshRepo,
    repoEvents,
    setRepos,
    updateAllPlugins,
} from '@revenge-mod/plugins/_/repositories'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { useCallback, useEffect, useReducer, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { api } from '..'
import { addDefaultRepoIfNeeded, toConfig } from '../repos'
import { showRemoveRepoConfirmation } from '../utils/alerts'
import { formatBytes, messageOf, showErrorToast } from '../utils/repos'
import type {
    DownloadProgressEvent,
    Repo,
    RepoConfigEntry,
    RepoStateEvent,
    RepoUpdate,
} from '@revenge-mod/plugins/_/repositories'

const {
    Button,
    ContextMenu,
    IconButton,
    Stack,
    TableRow,
    TableRowGroup,
    TableSwitchRow,
    TextInput,
} = Design

const MoreIcon = getAssetIdByName('MoreVerticalIcon')!
const UpIconComponent = lookupGeneratedIconComponent('ArrowSmallUpIcon')!
const DownIconComponent = lookupGeneratedIconComponent('ArrowSmallDownIcon')!
const TrashIconComponent = lookupGeneratedIconComponent('TrashIcon')!

function repoSubLabel(repo: Repo, state?: RepoStateEvent['state']) {
    const start = repo.description || repo.url
    if (state === 'refreshing') return `${start} (refreshing...)`
    if (state === 'error') return `${start} (refresh failed)`
    return start
}

interface UserRepoRowProps {
    repo: Repo
    state?: RepoStateEvent['state']
    onMove: (repo: Repo, delta: number) => void
    onRemove: (repo: Repo) => void
    onToggle: (repo: Repo, enabled: boolean) => void
}

function UserRepoRow({
    repo,
    state,
    onMove,
    onRemove,
    onToggle,
}: UserRepoRowProps) {
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
                label: 'Delete',
                IconComponent: TrashIconComponent,
                variant: 'destructive' as const,
                action: () =>
                    showRemoveRepoConfirmation(repo, () => onRemove(repo)),
            },
        ],
    ]

    return (
        <TableRow
            label={repo.name ?? repo.url}
            subLabel={repoSubLabel(repo, state)}
            trailing={
                <Stack direction="horizontal" spacing={8}>
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
    // Internal repositories are native-managed and not part of the config.
    const [repos, setReposState] = useState<Repo[]>([])
    const [url, setUrl] = useState('')
    const [busy, setBusy] = useState(false)
    const [updates, setUpdates] = useState<RepoUpdate[] | null>(null)
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
            resyncPluginSources().catch(() => {})
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
        setBusy(true)
        try {
            const { errors } = await refreshAllRepos()
            if (errors.length)
                showErrorToast(
                    errors.map(e => `${e.url}: ${e.error}`).join('\n'),
                )
            else await api.jsonStorage.set({ lastUpdateCheck: Date.now() })

            const result = await listAllUpdates()
            setUpdates(result.updates)
        } finally {
            setBusy(false)
            refresh()
        }
    }, [refresh])

    const updateAll = useCallback(async () => {
        setBusy(true)
        try {
            const { errors } = await updateAllPlugins()
            if (errors.length)
                showErrorToast(
                    errors.map(e => `${e.id}: ${e.error}`).join('\n'),
                )
            setUpdates(null)
        } finally {
            setBusy(false)
            refresh()
        }
    }, [refresh])

    const lastCheckedSubLabel =
        updates !== null && !updates.length
            ? 'All plugins up to date!'
            : settings?.lastUpdateCheck !== undefined &&
              `Last checked: ${new Date(settings.lastUpdateCheck).toLocaleString()}`

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
                    <TableRowGroup title="Repositories">
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
                    <TableRowGroup title="Updates">
                        <TableSwitchRow
                            label="Update plugins automatically"
                            subLabel="Check repositories and apply plugin updates after startup."
                            onValueChange={autoUpdate => {
                                api.jsonStorage.set({ autoUpdate })
                            }}
                            value={settings?.autoUpdate ?? true}
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
                                label={`Downloading ${progress.id} ${progress.version}`}
                                subLabel={`${formatBytes(progress.received)} / ${formatBytes(progress.total)} (${progress.index} of ${progress.count})`}
                            />
                        ) : null}
                        {updates?.length ? (
                            <>
                                {updates.map(update => (
                                    <TableRow
                                        icon={
                                            <TableRowAssetIcon name="DownloadIcon" />
                                        }
                                        key={update.id}
                                        label={update.id}
                                        subLabel={`${update.installed} → ${update.available} (${update.channel})`}
                                    />
                                ))}
                                <TableRow
                                    icon={
                                        <TableRowAssetIcon name="DownloadIcon" />
                                    }
                                    label="Update all"
                                    onPress={updateAll}
                                />
                            </>
                        ) : null}
                    </TableRowGroup>
                    <TableRowGroup title="Advanced">
                        <TableRow
                            icon={<TableRowAssetIcon name="DownloadIcon" />}
                            label="Install from file"
                            onPress={() =>
                                callNativeMethod(
                                    'revenge.plugins.installFile',
                                    [],
                                )
                            }
                        />
                        <TableRow
                            icon={<TableRowAssetIcon name="GlobeEarthIcon" />}
                            label="Restore default repositories"
                            onPress={async () => {
                                try {
                                    const restored =
                                        await addDefaultRepoIfNeeded(true)
                                    if (!restored) {
                                        ToastActionCreators.open({
                                            key: 'revenge-default-repo-nothing',
                                            content: 'Nothing to restore',
                                        })

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
