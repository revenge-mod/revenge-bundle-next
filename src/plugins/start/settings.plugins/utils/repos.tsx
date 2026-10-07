import {
    getInternalPluginMeta,
    resyncPluginSources,
} from '@revenge-mod/plugins/_'
import {
    installFromRepo,
    listRepoPlugins,
    planInstall,
    refreshRepo,
} from '@revenge-mod/plugins/_/repositories'
import { formatVersion } from '@revenge-mod/plugins/utils'
import { showErrorToast } from './alerts'
import { messageOf } from './strings'
import { describeIssue } from './updates'
import type { AnyPlugin } from '@revenge-mod/plugins/_'
import type {
    InstallPlan,
    InstallPlanAction,
    PlanTarget,
    RepoPluginListing,
} from '@revenge-mod/plugins/_/repositories'

/** Finds a plugin in a repository index. Refreshes it when `refresh` is set or nothing is cached. */
export async function findRepoListing(
    url: string,
    id: string,
    refresh = false,
): Promise<RepoPluginListing | undefined> {
    if (!refresh)
        try {
            return (await listRepoPlugins(url)).find(l => l.id === id)
        } catch {
            // Not cached yet
        }

    await refreshRepo(url)
    return (await listRepoPlugins(url)).find(l => l.id === id)
}

/** Returns {@link preferred} if offered, else `latest`, else the first channel. */
export function pickChannel(listing: RepoPluginListing, preferred?: string) {
    const { channels } = listing
    if (preferred && preferred in channels) return preferred
    if ('latest' in channels) return 'latest'
    return (
        Object.keys(channels).sort((a, b) => a.localeCompare(b))[0] ?? 'latest'
    )
}

/** How a plugin should update. */
export type PluginRef =
    | { type: 'channel'; channel: string }
    | { type: 'version'; version: string }

/** A repository serving a plugin. */
export interface RepoOffer {
    url: string
    name: string | null
    listing: RepoPluginListing
}

/** {@link ref} from {@link repo} as a plan target. */
export const planTargetOf = (repo: string, ref: PluginRef): PlanTarget =>
    ref.type === 'version'
        ? { repo, version: ref.version }
        : { repo, channel: ref.channel }

/**
 * Installs a plugin from {@link repo} following {@link ref}.
 *
 * Errors show as toasts. Resolves `true` only when the plugin now follows {@link ref}.
 */
export function installPluginRef(
    id: string,
    repo: string,
    ref: PluginRef,
): Promise<boolean> {
    return installPlugins(
        [id],
        { [id]: planTargetOf(repo, ref) },
        ref.type === 'version'
            ? `Updates will be paused to stay on v${ref.version}. Pick a channel or turn on "Allow updates" to receive updates again.`
            : undefined,
    )
}

/**
 * Plans, confirms, and installs {@link ids}. Shows errors as toasts.
 * Resolves `true` when everything installed, or nothing needed installing.
 */
export async function installPlugins(
    ids: string[],
    targets: Record<string, PlanTarget> = {},
    /** Extra line under the summary. */
    note?: string,
): Promise<boolean> {
    try {
        const plan = await planAll(ids, targets)
        if (!plan.actions.length) return true
        if (plan.warnings.length)
            showErrorToast(plan.warnings.map(describeIssue).join('\n'))

        // Prevent circular imports
        const { showPluginPlanConfirmAlert } = await import(
            '../components/PluginPlanConfirmAlert'
        )

        const confirmed = await showPluginPlanConfirmAlert({
            ids,
            targets,
            plan,
            note,
        })
        if (!confirmed) return false

        await installFromRepo(confirmed)
        await resyncPluginSources()
        return true
    } catch (e) {
        showErrorToast(messageOf(e))
        return false
    }
}

/** Plans every ID with the same {@link targets} and merges the plans. */
export async function planAll(
    ids: string[],
    targets: Record<string, PlanTarget>,
): Promise<InstallPlan> {
    const plans = await Promise.all(ids.map(id => planInstall(id, { targets })))
    if (plans.length === 1) return plans[0]!

    const actions = new Map<string, InstallPlanAction>()
    for (const { actions: planned } of plans)
        for (const action of planned) {
            const existing = actions.get(action.id)
            if (!existing) {
                actions.set(action.id, action)
                continue
            }

            const candidates: InstallPlanAction['candidates'] = {}
            for (const [repo, versions] of Object.entries(
                existing.candidates,
            )) {
                const other = action.candidates[repo]
                if (!other) continue
                candidates[repo] = Object.fromEntries(
                    Object.entries(versions).filter(([v]) => v in other),
                )
            }

            actions.set(action.id, {
                ...existing,
                dependents: [
                    ...existing.dependents,
                    ...action.dependents.filter(
                        d => !existing.dependents.some(e => e.id === d.id),
                    ),
                ],
                candidates,
            })
        }

    const warnings = [...new Set(plans.flatMap(plan => plan.warnings))]

    return { actions: [...actions.values()], warnings }
}

/** What {@link plugin} updates follow. */
export function pluginRefOf(plugin: AnyPlugin): PluginRef {
    const { source, pendingVersion } = getInternalPluginMeta(plugin)

    return source?.held
        ? {
              type: 'version',
              // Pending install is newer than the running manifest
              version: pendingVersion ?? formatVersion(plugin.manifest.version),
          }
        : { type: 'channel', channel: source?.channel ?? 'latest' }
}

/** Returns the closest {@link ref} in another listing. Missing versions fall back to a channel pointer. */
export function retargetPluginRef(
    ref: PluginRef,
    listing: RepoPluginListing,
): PluginRef {
    if (ref.type === 'channel')
        return { type: 'channel', channel: pickChannel(listing, ref.channel) }

    if (ref.version in listing.versions) return ref

    const version = versionOfChannel(listing, pickChannel(listing))
    return version
        ? { type: 'version', version }
        : { type: 'channel', channel: pickChannel(listing) }
}

/** The version {@link channel} points to, or the newest when the listing doesn't have it. */
export function versionOfChannel(
    listing: RepoPluginListing,
    channel: string,
): string | undefined {
    return listing.channels[channel] ?? listing.order[0]
}
