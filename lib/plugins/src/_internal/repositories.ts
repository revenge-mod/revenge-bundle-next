import { TypedEventEmitter } from '@revenge-mod/discord/common/utils'
import { registerJSMethod } from '@revenge-mod/modules/native'
import { callPluginSystemMethod } from './native'
import type { PluginSource } from '.'

export interface DownloadProgressEvent {
    id: string
    version: string
    /** Provenance repository URL. */
    repo: string
    /** Downloaded bytes. */
    received: number
    /** Total byte size from install plan. */
    total: number
    /** 1-based index in download sequence. */
    index: number
    /** Total artifact count in plan. */
    count: number
}

export interface RepoStateEvent {
    url: string
    state: 'refreshing' | 'ready' | 'error'
    error?: string
}

export const repoEvents = new TypedEventEmitter<{
    downloadProgress: [DownloadProgressEvent]
    repoState: [RepoStateEvent]
}>()

export function registerRepositoryEvents() {
    registerJSMethod(
        'revenge.plugins.events.downloadProgress',
        (event: DownloadProgressEvent) => {
            repoEvents.emit('downloadProgress', event)
        },
    )

    registerJSMethod(
        'revenge.plugins.events.repoStateUpdate',
        (event: RepoStateEvent) => {
            repoEvents.emit('repoState', event)
        },
    )
}

export interface Repo {
    /** Absolute root URL and unique identity of the repository. */
    url: string
    enabled: boolean
    internal: boolean
    // Display metadata from the index
    name: string | null
    description: string | null
    /** Packaged asset name or `data:` URL. */
    icon: string | null
}

export interface RepoConfigEntry {
    url: string
    enabled?: boolean
}

export function listRepos(): Promise<Repo[]> {
    return callPluginSystemMethod('revenge.plugins.repos.list', [])
}

export function setRepos(config: RepoConfigEntry[]): Promise<null> {
    return callPluginSystemMethod('revenge.plugins.repos.set', [config])
}

export function refreshRepo(url: string): Promise<Repo> {
    return callPluginSystemMethod('revenge.plugins.repos.refresh', [url])
}

/** Refreshes enabled user repositories in parallel, collecting per-repository errors. */
export async function refreshAllRepos(): Promise<{
    refreshed: Repo[]
    errors: { url: string; error: unknown }[]
}> {
    const repos = await listRepos()
    const refreshed: Repo[] = []
    const errors: { url: string; error: unknown }[] = []

    await Promise.all(
        repos
            .filter(repo => !repo.internal && repo.enabled)
            .map(repo =>
                refreshRepo(repo.url).then(
                    result => {
                        refreshed.push(result)
                    },
                    error => {
                        errors.push({ url: repo.url, error })
                    },
                ),
            ),
    )

    return { refreshed, errors }
}

export interface RepoPluginListing {
    id: string
    name: string
    description: string
    author: string
    /** Packaged asset name or `data:` URL. */
    icon: string | null
    /** Channel target pointers (e.g. `latest`) referencing keys of {@link versions}. */
    channels: Record<string, string>
    versions: Record<
        string,
        {
            /** Absolute artifact download URL, or `null` for internal repositories. */
            url: string | null
            sha256: string | null
            size: number
            dependencies: Record<
                string,
                {
                    version: string
                    optional: boolean
                }
            >
        }
    >
}

export interface InstallPlanAction {
    id: string
    version: string
    url: string
    sha256: string
    size: number
    /** Source repository recorded as installation provenance. */
    repo: string
    /** Tracking update channel. */
    channel: string
    /** The installed version being replaced, or `null` for fresh installs. */
    replaces: string | null
}

export interface InstallPlan {
    actions: InstallPlanAction[]
    /** Non-blocking problems (dependency resolution). */
    warnings: string[]
}

export interface RepoUpdate {
    id: string
    installed: string
    available: string
    channel: string
}

/** Lists plugins for repository from cached index. */
export function listRepoPlugins(url: string): Promise<RepoPluginListing[]> {
    return callPluginSystemMethod('revenge.plugins.repos.listPlugins', [url])
}

/** Computes dependency installation plan against cached repository indexes. */
export function planInstall(
    id: string,
    version?: string,
    channel?: string,
    filteredRepos?: string[],
): Promise<InstallPlan> {
    return callPluginSystemMethod('revenge.plugins.planInstall', [
        id,
        version ?? null,
        channel ?? null,
        filteredRepos ?? null,
    ])
}

/** Updates plugin hold status, pinning version or resuming channel updates. */
export function setPluginHeld(
    id: string,
    held: boolean,
): Promise<PluginSource> {
    return callPluginSystemMethod('revenge.plugins.setHeld', [id, held])
}

/** Executes an install plan, downloading and applying artifacts to disk. */
export function installFromRepo(plan: InstallPlan): Promise<{
    installed: string[]
    pending: string[]
    skipped: string[]
}> {
    return callPluginSystemMethod('revenge.plugins.install', [plan])
}

/** Lists updates for plugins pinned to repository from cached index. */
export function listUpdates(url: string): Promise<RepoUpdate[]> {
    return callPluginSystemMethod('revenge.plugins.repos.listUpdates', [url])
}

/** Lists updates across enabled user repositories in parallel. */
export async function listAllUpdates(): Promise<{
    updates: RepoUpdate[]
    errors: { url: string; error: unknown }[]
}> {
    const repos = await listRepos()
    const updates: RepoUpdate[] = []
    const errors: { url: string; error: unknown }[] = []

    await Promise.all(
        repos
            .filter(repo => !repo.internal && repo.enabled)
            .map(repo =>
                listUpdates(repo.url).then(
                    result => {
                        updates.push(...result)
                    },
                    error => {
                        errors.push({ url: repo.url, error })
                    },
                ),
            ),
    )

    return { updates, errors }
}

/**
 * Resolves and installs pending updates across all repositories.
 */
export async function updateAllPlugins(): Promise<{
    installed: string[]
    pending: string[]
    errors: { id: string; error: unknown }[]
}> {
    const { updates } = await listAllUpdates()
    const installed: string[] = []
    const pending: string[] = []
    const errors: { id: string; error: unknown }[] = []

    await Promise.all(
        updates.map(async update => {
            try {
                const plan = await planInstall(
                    update.id,
                    undefined,
                    update.channel,
                )
                const result = await installFromRepo(plan)
                installed.push(...result.installed)
                pending.push(...result.pending)
            } catch (error) {
                errors.push({ id: update.id, error })
            }
        }),
    )

    return { installed, pending, errors }
}

declare module '@revenge-mod/modules/native' {
    interface NativeMethods {
        'revenge.plugins.repos.list': [[], Repo[]]
        'revenge.plugins.repos.set': [[config: RepoConfigEntry[]], null]
        'revenge.plugins.repos.refresh': [[url: string], Repo]
        'revenge.plugins.repos.listPlugins': [
            [url: string],
            RepoPluginListing[],
        ]
        'revenge.plugins.repos.listUpdates': [[url: string], RepoUpdate[]]
        'revenge.plugins.planInstall': [
            [
                id: string,
                version: string | null,
                channel: string | null,
                filteredRepos: string[] | null,
            ],
            InstallPlan,
        ]
        'revenge.plugins.install': [
            [plan: InstallPlan],
            { installed: string[]; pending: string[]; skipped: string[] },
        ]
        'revenge.plugins.setHeld': [[id: string, held: boolean], PluginSource]
    }
}
