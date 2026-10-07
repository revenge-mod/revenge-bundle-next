import { pList, resyncPluginSources } from '@revenge-mod/plugins/_'
import {
    breakingIssuesOf,
    listRepos,
    listUpdates,
    refreshAllRepos,
    selectSafeUpdates,
    updatePlugins,
} from '@revenge-mod/plugins/_/repositories'
import { noop } from '@revenge-mod/utils/callback'
import { createStore } from 'zustand/vanilla'
import { api } from '..'
import { showErrorToast } from './alerts'
import { messageOf } from './strings'
import type {
    PluginUpdate,
    ResolveIssue,
} from '@revenge-mod/plugins/_/repositories'

export interface UpdatesState {
    /** Listed updates, `null` until first listed. */
    updates: PluginUpdate[] | null
    /** Repository names keyed by URL. */
    repoNames: Record<string, string | null>
    /** IDs of updates to install. */
    selected: ReadonlySet<string>
    checking: boolean
    installing: boolean
}

export const updatesStore = createStore<UpdatesState>(() => ({
    updates: null,
    repoNames: {},
    selected: new Set(),
    checking: false,
    installing: false,
}))

/**
 * Lists updates into {@link updatesStore}, selecting safe updates. If {@link refresh} is true, refreshes repositories first.
 *
 * Resolves `false` when some failed to refresh.
 */
export async function loadUpdates(refresh: boolean): Promise<boolean> {
    updatesStore.setState({ checking: true })
    try {
        let refreshed = true
        if (refresh) {
            const { errors } = await refreshAllRepos()
            refreshed = !errors.length
            if (refreshed)
                await api.jsonStorage.set({ lastUpdateCheck: Date.now() })
            else
                showErrorToast(
                    errors
                        .map(e => `${e.url}: ${messageOf(e.error)}`)
                        .join('\n'),
                )
        }

        const [updates, repos] = await Promise.all([listUpdates(), listRepos()])
        updatesStore.setState({
            updates,
            repoNames: Object.fromEntries(
                repos.map(repo => [repo.url, repo.name]),
            ),
            selected: selectSafeUpdates(updates),
        })

        return refreshed
    } finally {
        updatesStore.setState({ checking: false })
    }
}

export function toggleUpdate(id: string) {
    const selected = new Set(updatesStore.getState().selected)
    if (!selected.delete(id)) selected.add(id)
    updatesStore.setState({ selected })
}

/** Installs selected updates, then lists updates again. */
export async function installSelectedUpdates() {
    updatesStore.setState({ installing: true })
    try {
        const result = await updatePlugins(updatesStore.getState().selected)
        await resyncPluginSources().catch(noop)
        await loadUpdates(false).catch(e => showErrorToast(messageOf(e)))
        return result
    } finally {
        updatesStore.setState({ installing: false })
    }
}

/** Name of installed plugin {@link id}, or the ID itself. */
export const nameOf = (id: string) => pList.get(id)?.manifest.name ?? id

/** Describes {@link issue} for users, naming installed plugins by name. */
export function describeIssue(issue: ResolveIssue): string {
    switch (issue.type) {
        case 'breaks':
            return `Breaks ${nameOf(issue.dependent)}, which needs ${nameOf(issue.id)} ${issue.range}.${issue.fixedBy ? ' Select its update to fix this.' : ''}`
        case 'conflict':
            return `${nameOf(issue.dependent)} v${issue.dependentVersion} needs ${nameOf(issue.id)} ${issue.range}, but gets v${issue.version}.`
        case 'unresolved': {
            const name = nameOf(issue.id)
            const problem =
                issue.reason === 'held'
                    ? `${name} is paused at v${issue.installed}, but ${issue.range} is needed. Resume its updates first.`
                    : issue.reason === 'target'
                      ? `${issue.detail}`
                      : `No version of ${name} matching ${issue.range} is available`
            return issue.optional
                ? `Skips optional ${name}. ${problem}`
                : problem
        }
        case 'unavailable':
            return issue.version
                ? `Version ${issue.version} is not available`
                : 'Not available from its repository'
        case 'held':
            return `Updates are paused at v${issue.version}. Turn on "Allow updates" to update.`
        case 'downgrade':
            return `Downgrades from v${issue.from} to v${issue.to}`
        case 'upToDate':
            return 'Already up to date'
    }
}

/** Lists notes about {@link update} under the currently {@link selected}, most severe first. */
export function updateNotesOf(
    update: PluginUpdate,
    selected: ReadonlySet<string>,
): UpdateNote[] {
    const warn = (issue: ResolveIssue): UpdateNote => ({
        text: describeIssue(issue),
        warning: true,
    })

    if (update.blocker) return [warn(update.blocker)]

    const notes = breakingIssuesOf(update, selected).map(warn)

    // Breaks fixed by selected updates stay quiet
    for (const issue of update.warnings)
        if (issue.type !== 'breaks' && issue.type !== 'conflict')
            notes.push(warn(issue))

    for (const action of update.includes)
        notes.push({
            text: action.replaces
                ? `Also updates ${nameOf(action.id)} to v${action.version}.`
                : `Also installs ${nameOf(action.id)} v${action.version}.`,
            warning: false,
        })

    return notes
}

export interface UpdateNote {
    text: string
    /** {@link ResolveIssue}. */
    warning: boolean
}

/** Download size of {@link update} with its included actions. */
export const updateSizeOf = (update: PluginUpdate) =>
    update.includes.reduce((total, action) => total + action.size, update.size)
