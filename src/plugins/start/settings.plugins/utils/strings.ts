import {
    getInternalPluginMeta,
    isPluginPendingUpdate,
} from '@revenge-mod/plugins/_'
import { listRepos } from '@revenge-mod/plugins/_/repositories'
import { formatVersion } from '@revenge-mod/plugins/utils'
import { noop } from '@revenge-mod/utils/callback'
import { useEffect, useState } from 'react'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

export const pluralize = (count: number, noun: string) =>
    `${count} ${noun}${count === 1 ? '' : 's'}`

export const formatRepository = (url: string, name: string | null) =>
    name ? `${name} (${url})` : url

export function versionTextOf(plugin: AnyPlugin) {
    const running = formatVersion(plugin.manifest.version)
    const installed = getInternalPluginMeta(plugin).pendingVersion
    if (installed && installed !== running)
        return `v${running} \u2192 v${installed} after reload`
    return `v${running}${isPluginPendingUpdate(plugin) ? ' (update pending reload)' : ''}`
}

export function useRepositoryText(repo: string | null, builtIn: boolean) {
    const [name, setName] = useState<string | null>(null)

    useEffect(() => {
        setName(null)
        if (!repo) return
        listRepos().then(repos => {
            setName(repos.find(r => r.url === repo)?.name ?? null)
        }, noop)
    }, [repo])

    if (repo) return formatRepository(repo, name)
    return builtIn ? 'Built-in' : 'Sideloaded'
}
