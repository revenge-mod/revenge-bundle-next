import {
    listRepos,
    refreshRepo,
    setRepos,
} from '@revenge-mod/plugins/_/repositories'
import { noop } from '@revenge-mod/utils/callback'
import { api } from '.'
import type { Repo, RepoConfigEntry } from '@revenge-mod/plugins/_/repositories'

export async function addDefaultRepoIfNeeded() {
    if (!__BUILD_DEFAULT_PLUGIN_REPOSITORY_URL__) return

    const repos = await listRepos()
    if (
        repos.some(repo => repo.url === __BUILD_DEFAULT_PLUGIN_REPOSITORY_URL__)
    )
        return

    const userRepos = toConfig(repos.filter(repo => !repo.internal))
    await setRepos([
        { url: __BUILD_DEFAULT_PLUGIN_REPOSITORY_URL__, enabled: true },
        ...userRepos,
    ])

    await api.jsonStorage.set({ defaultRepoRestored: true }).catch(noop)

    await refreshRepo(__BUILD_DEFAULT_PLUGIN_REPOSITORY_URL__).catch(noop)
}

export function toConfig(list: Repo[]): RepoConfigEntry[] {
    return list.map(({ url, enabled }) => ({ url, enabled }))
}
