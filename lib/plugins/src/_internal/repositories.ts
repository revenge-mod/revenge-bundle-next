import { TypedEventEmitter } from '@revenge-mod/discord/common/utils'
import { callNativeMethod, registerJSMethod } from '@revenge-mod/modules/native'

export interface DownloadProgressEvent {
    id: string
    version: string
    /** The repository the artifact downloads from. */
    repo: string
    /** Bytes received so far. */
    received: number
    /** Total bytes, from the plan's size field. */
    total: number
    /** 1-based position of this artifact in the plan. */
    index: number
    /** Number of artifacts in the plan. */
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

/**
 * A plugin repository as reported by native.
 *
 * The repository's URL is its identity.
 * The hidden internal repository (serving internal plugins) is always first and cannot be modified or removed.
 */
export interface Repo {
    /** Absolute URL of the repository root; also its identity. */
    url: string
    enabled: boolean
    internal: boolean
    /** Display metadata from the cached index, if any. */
    name: string | null
    description: string | null
    /** A Discord-packaged asset name or a `data:` URL. Never a remote URL. */
    icon: string | null
}

export interface RepoConfigEntry {
    url: string
    enabled?: boolean
}

export function listRepos(): Promise<Repo[]> {
    return callNativeMethod('revenge.plugins.repos.list', [])
}

export function setRepos(config: RepoConfigEntry[]): Promise<null> {
    return callNativeMethod('revenge.plugins.repos.set', [config])
}

export function refreshRepo(url: string): Promise<Repo> {
    return callNativeMethod('revenge.plugins.repos.refresh', [url])
}

/**
 * Refreshes every enabled user repository in parallel.
 * Per-repo failures are collected instead.
 */
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
    /** A Discord-packaged asset name or a `data:` URL. Never a remote URL. */
    icon: string | null
    /** Channel pointers (eg. `latest`), each naming a key of {@link versions}. */
    channels: Record<string, string>
    versions: Record<
        string,
        {
            /** Absolute artifact URL. `null` for the internal repository (nothing downloadable). */
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
    /** The repository this action installs from (recorded as provenance). */
    repo: string
    /** The channel followed for future update checks. */
    channel: string
    /** The installed version being replaced, or `null` for a fresh install. */
    replaces: string | null
}

export interface InstallPlan {
    actions: InstallPlanAction[]
    /** Non-blocking problems (skipped optionals, dependent-range conflicts). */
    warnings: string[]
}

export interface RepoUpdate {
    id: string
    installed: string
    available: string
    channel: string
}

/**
 * Lists one repository's plugins from its cached index.
 */
export function listRepoPlugins(url: string): Promise<RepoPluginListing[]> {
    return callNativeMethod('revenge.plugins.repos.listPlugins', [url])
}

/**
 * Resolves an install of one plugin (+ unsatisfied dependencies) against cached indexes.
 */
export function planInstall(
    id: string,
    version?: string,
    channel?: string,
    filteredRepos?: string[],
): Promise<InstallPlan> {
    return callNativeMethod('revenge.plugins.planInstall', [
        id,
        version ?? null,
        channel ?? null,
        filteredRepos ?? null,
    ])
}

/**
 * Executes one confirmed install plan: download all, verify all, then apply on disk.
 *
 * - Fresh plugins (new IDs with live dependencies) load immediately (`installed`).
 * - Updates, and fresh IDs depending on them, only land on disk and load at next reload (`pending`).
 * - `skipped` lists actions an overlapping plan already satisfied.
 */
export function installFromRepo(plan: InstallPlan): Promise<{
    installed: string[]
    pending: string[]
    skipped: string[]
}> {
    return callNativeMethod('revenge.plugins.install', [plan])
}

/**
 * Lists available updates for plugins pinned to one repository, from its **cached index**.
 * Call {@link refreshRepo} first to ensure the index is up-to-date.
 */
export function listUpdates(url: string): Promise<RepoUpdate[]> {
    return callNativeMethod('revenge.plugins.repos.listUpdates', [url])
}

/**
 * Lists updates across every enabled user repository in parallel.
 * Per-repo failures (eg. no cached index yet) are returned.
 */
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
 * Resolves and installs updates for every entry of {@link listAllUpdates}.
 * Failures are collected per plugin. Updates land on disk only (`pending`), a reload applies them.
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
    }
}
