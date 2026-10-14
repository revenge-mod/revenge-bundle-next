import { useSyncExternalStore } from 'react'
import type { PluginManifest } from '@revenge-mod/plugins/types'
import type { PluginMatch, PluginMatchInfo } from './api'

// Plugins claimed by other plugins for custom pages, excluded from standard plugin views. Loaded at start stage without UI.

const claims = new Set<PluginMatch>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
    version++
    for (const listener of listeners) listener()
}

/** Excludes plugins matching {@link match} from standard plugin pages until calling the returned unregister function. */
export function claimPlugins(match: PluginMatch) {
    claims.add(match)
    emit()

    return () => {
        if (claims.delete(match)) emit()
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** Reactive version tracking active claims to trigger re-filtering. */
export function usePluginClaimsVersion() {
    return useSyncExternalStore(subscribe, () => version)
}

/** Returns false if a match predicate throws an exception. */
function matches(match: PluginMatch, plugin: PluginMatchInfo) {
    try {
        return match(plugin)
    } catch {
        return false
    }
}

/** Checks whether {@link plugin} belongs on a page filtered by {@link match}, or on standard pages unless claimed elsewhere. */
export function belongsOnPage(plugin: PluginMatchInfo, match?: PluginMatch) {
    if (match) return matches(match, plugin)
    for (const claim of claims) if (matches(claim, plugin)) return false
    return true
}

export function matchInfoOfManifest(manifest: PluginManifest): PluginMatchInfo {
    const dependencies: PluginMatchInfo['dependencies'] = {}
    for (const [id, spec] of Object.entries(manifest.dependencies ?? {}))
        dependencies[id] = { optional: Boolean(spec.optional) }

    const { id, name, description, author } = manifest
    return { id, name, description, author, dependencies }
}
