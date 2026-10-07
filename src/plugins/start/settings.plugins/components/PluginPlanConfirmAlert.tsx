import { getAssetIdByName } from '@revenge-mod/assets'
import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { listRepoPlugins, listRepos } from '@revenge-mod/plugins/_/repositories'
import { noop } from '@revenge-mod/utils/callback'
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react'
import { ScrollView, View } from 'react-native'
import { showErrorToast } from '../utils/alerts'
import { findRepoListing, pickChannel, planAll } from '../utils/repos'
import { formatBytes, messageOf } from '../utils/strings'
import { describeIssue } from '../utils/updates'
import PluginInstallConfirmAlert from './PluginInstallConfirmAlert'
import {
    ChannelRadioGroup,
    RepositoryRadioGroup,
    VersionRadioGroup,
} from './PluginSourceRadioGroups'
import type {
    InstallPlan,
    InstallPlanAction,
    PlanTarget,
    RepoPluginListing,
} from '@revenge-mod/plugins/_/repositories'
import type { PluginInstallConfirmItem } from './PluginInstallConfirmAlert'
import type { VersionConstraints } from './PluginSourceRadioGroups'

const {
    IconButton,
    Stack,
    Tabs,
    Text,
    createStyles,
    useSegmentedControlState,
} = Design

const ArrowSmallLeftIcon = getAssetIdByName('ArrowSmallLeftIcon', 'png')!

const PlanConfirmAlertKey = 'repo-install-plan-confirm'

/** Plan action with card info. */
interface PlanItem extends PluginInstallConfirmItem {
    action: InstallPlanAction
}

export interface PluginPlanConfirmAlertProps {
    /** Requested plugin IDs. */
    ids: string[]
    /** Targets used for planning. */
    targets: Record<string, PlanTarget>
    plan: InstallPlan
    /** Extra text under the summary. */
    note?: string
}

/**
 * Shows a plan for confirmation. Dependencies can be skipped or retargeted.
 * Resolves with the confirmed plan, or `null` when cancelled.
 */
export async function showPluginPlanConfirmAlert(
    props: PluginPlanConfirmAlertProps,
): Promise<InstallPlan | null> {
    const items = await describePlan(props.plan)

    let resolve!: (value: InstallPlan | null) => void
    const promise = new Promise<InstallPlan | null>(r => (resolve = r))

    AlertActionCreators.openAlert(
        PlanConfirmAlertKey,
        <PluginPlanConfirmAlert {...props} items={items} onDone={resolve} />,
        () => resolve(null),
    )

    return promise.finally(() =>
        AlertActionCreators.dismissAlert(PlanConfirmAlertKey),
    )
}

interface PlanContextValue {
    items: PlanItem[]
    /** Re-planning in progress. */
    busy: boolean
    /** Item currently on the source page. */
    editing: PlanItem | undefined
    /** Opens an item's page, or the list with `null`. */
    edit: (id: string | null) => void
    /** Re-plans with a new target. */
    retarget: (id: string, target: PlanTarget) => void
    nameOf: (id: string) => string
}

const PlanContext = createContext<PlanContextValue | null>(null)

function usePlan() {
    const context = useContext(PlanContext)
    if (!context) throw new Error('usePlan must be used within PlanContext')
    return context
}

function PluginPlanConfirmAlert({
    ids,
    targets: initialTargets,
    plan: initialPlan,
    items: initialItems,
    note,
    onDone,
}: PluginPlanConfirmAlertProps & {
    items: PlanItem[]
    onDone: (plan: InstallPlan | null) => void
}) {
    const [state, setState] = useState({
        plan: initialPlan,
        items: initialItems,
        targets: initialTargets,
    })
    const [editingId, setEditingId] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const { plan, items, targets } = state

    const retarget = useCallback(
        async (id: string, target: PlanTarget) => {
            const next = { ...targets, [id]: target }
            setBusy(true)

            try {
                const replanned = await planAll(ids, next)
                if (replanned.warnings.length)
                    showErrorToast(
                        replanned.warnings.map(describeIssue).join('\n'),
                    )

                setState({
                    plan: replanned,
                    items: await describePlan(replanned),
                    targets: next,
                })
                // Dropped from the plan, eg. no version satisfies its dependents
                if (!replanned.actions.some(a => a.id === id))
                    setEditingId(null)
            } catch (e) {
                showErrorToast(messageOf(e))
            } finally {
                setBusy(false)
            }
        },
        [ids, targets],
    )

    const context = useMemo<PlanContextValue>(
        () => ({
            items,
            busy,
            editing: editingId
                ? items.find(i => i.id === editingId)
                : undefined,
            edit: setEditingId,
            retarget,
            nameOf: id => items.find(i => i.id === id)?.name ?? id,
        }),
        [items, busy, editingId, retarget],
    )

    // Requested plugins are targeted before planning
    const listed = useMemo(
        () =>
            items.map(item =>
                item.dependents?.length
                    ? {
                          ...item,
                          onPressVersion: () => setEditingId(item.id),
                          onPressRepository: () => setEditingId(item.id),
                      }
                    : item,
            ),
        [items],
    )

    const roots = items.filter(item => !item.dependents?.length)
    const hasOptional = items.some(
        item =>
            item.dependents?.length && item.dependents.every(d => d.optional),
    )

    return (
        <PlanContext.Provider value={context}>
            <PluginInstallConfirmAlert
                title={
                    roots.length === 1
                        ? `Install ${roots[0]!.name}?`
                        : `Install ${roots.length} plugins?`
                }
                content={
                    [
                        items.length > roots.length
                            ? hasOptional
                                ? `${roots[0]!.name} requires extra plugins. Uncheck any optional ones you don't need.`
                                : `${roots[0]!.name} requires extra plugins.`
                            : undefined,
                        note,
                    ]
                        .filter(Boolean)
                        .join('\n\n') || undefined
                }
                items={listed}
                busy={busy}
                page={context.editing && <PlanTargetPage />}
                onConfirm={included =>
                    onDone({
                        ...plan,
                        actions: plan.actions.filter(a => included.has(a.id)),
                    })
                }
                onCancel={() => onDone(null)}
            />
        </PlanContext.Provider>
    )
}

/** Picks the repository, channel, or version of the planned plugin being edited. */
function PlanTargetPage() {
    const { editing, busy, edit, retarget, nameOf } = usePlan()
    // Only rendered while editing
    const item = editing!
    const styles_ = useStyles()
    const { action } = item

    const [repoNames, setRepoNames] = useState<Map<string, string | null>>(
        () => new Map(),
    )
    const [listing, setListing] = useState<RepoPluginListing | null>(null)

    useEffect(() => {
        listRepos().then(
            repos => setRepoNames(new Map(repos.map(r => [r.url, r.name]))),
            noop,
        )
    }, [])

    useEffect(() => {
        let stale = false
        setListing(null)
        findRepoListing(action.repo, item.id).then(
            found => !stale && setListing(found ?? null),
            e => showErrorToast(messageOf(e)),
        )
        return () => {
            stale = true
        }
    }, [action.repo, item.id])

    const candidates = action.candidates[action.repo] ?? {}
    const followsVersion = action.hold === true

    const requirement = `Needs ${action.dependents
        .map(d => `${d.range} for ${nameOf(d.id)}`)
        .join(', ')}`

    const constraints: VersionConstraints = {
        candidates,
        reason: requirement,
        nameOf,
    }

    const select = (target: PlanTarget) => {
        if (!busy) retarget(item.id, target)
    }

    const channelCount = listing ? Object.keys(listing.channels).length : 0
    const versionCount = listing ? Object.keys(listing.versions).length : 0

    // No pager, too little room in the dialog
    const tabItems = useMemo(
        () => [
            { id: 'channels', label: 'Channels', count: channelCount },
            { id: 'versions', label: 'Versions', count: versionCount },
        ],
        [channelCount, versionCount],
    )
    const [tab, setTab] = useState(followsVersion ? 1 : 0)
    // Keeps the tab when counts load
    const tabs = useSegmentedControlState({
        items: tabItems,
        pageWidth: 0,
        defaultIndex: tab,
        onSetActiveIndex: setTab,
        onPageChange: setTab,
    })

    /** Retargets to {@link url}, keeping the followed ref when it's a candidate there. */
    async function retargetRepository(url: string) {
        if (busy) return

        const ok = action.candidates[url] ?? {}
        if (followsVersion && action.version in ok)
            return select({ repo: url, version: action.version })

        try {
            const there = await findRepoListing(url, item.id)
            const channel = there && pickChannel(there, action.channel)
            const pointer = channel && there.channels[channel]

            select(
                pointer && pointer in ok
                    ? { repo: url, channel }
                    : { repo: url },
            )
        } catch (e) {
            showErrorToast(messageOf(e))
        }
    }

    return (
        <View style={styles_.page}>
            <Stack direction="horizontal" align="center" spacing={8}>
                <IconButton
                    size="sm"
                    variant="secondary"
                    icon={ArrowSmallLeftIcon}
                    accessibilityLabel="Back to plugins"
                    onPress={() => edit(null)}
                />
                <Text
                    variant="heading-md/semibold"
                    lineClamp={1}
                    style={styles_.title}
                >
                    Source for {item.name}
                </Text>
            </Stack>
            <ScrollView nestedScrollEnabled style={styles_.scroll}>
                <Stack spacing={16}>
                    <RepositoryRadioGroup
                        repos={Object.entries(action.candidates).map(
                            ([url, ok]) => ({
                                url,
                                name: repoNames.get(url) ?? null,
                                unavailable: Object.keys(ok).length
                                    ? undefined
                                    : 'No compatible version',
                            }),
                        )}
                        value={action.repo}
                        onChange={retargetRepository}
                        disabled={busy}
                    />
                    <View>
                        <Tabs state={tabs} />
                    </View>
                    {listing &&
                        (tab === 0 ? (
                            <ChannelRadioGroup
                                listing={listing}
                                value={followsVersion ? null : action.channel}
                                onChange={channel =>
                                    select({ repo: action.repo, channel })
                                }
                                disabled={busy}
                                constraints={constraints}
                            />
                        ) : (
                            <VersionRadioGroup
                                listing={listing}
                                value={followsVersion ? action.version : null}
                                onChange={version =>
                                    select({ repo: action.repo, version })
                                }
                                disabled={busy}
                                constraints={constraints}
                            />
                        ))}
                </Stack>
            </ScrollView>
        </View>
    )
}

/** Builds card items from plan actions and their listings. */
async function describePlan(plan: InstallPlan): Promise<PlanItem[]> {
    const repos = await listRepos()
    const listings = new Map<string, Promise<RepoPluginListing[]>>()

    return Promise.all(
        plan.actions.map(async action => {
            let fetched = listings.get(action.repo)
            if (!fetched)
                listings.set(
                    action.repo,
                    (fetched = listRepoPlugins(action.repo).catch(() => [])),
                )

            const listing = (await fetched).find(p => p.id === action.id)
            const repo = repos.find(r => r.url === action.repo)

            return {
                action,
                id: action.id,
                name: listing?.name || action.id,
                description: listing?.description ?? '',
                icon: listing?.icon ?? undefined,
                version: action.replaces
                    ? `v${action.replaces} \u2192 v${action.version}`
                    : `v${action.version}`,
                size: formatBytes(action.size),
                repository: repo?.name || action.repo,
                dependents: action.dependents,
            }
        }),
    )
}

const useStyles = createStyles({
    page: {
        flex: 1,
        gap: 12,
    },
    title: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
})
