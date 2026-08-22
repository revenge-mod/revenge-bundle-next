import { createStore } from 'zustand/vanilla'

/**
 * Reactive and observable source of truth for {@link InternalPluginMeta.flags} and {@link Plugin.status}.
 *
 * @see {@link file://./react.ts} for React bindings
 *
 * @see {@link file://./state.ts}
 */

export interface PluginStoreState {
    /** Registered plugin IDs, in registration order. */
    ids: string[]
    /** Flags of the running plugins, keyed by plugin ID. */
    sessionFlags: Record<string, number>
    /**
     * Flags of the saved setup, keyed by plugin ID. Only filled during a defaults-only boot,
     * when the session runs on defaults while the UI shows and edits the saved setup.
     */
    savedFlags: Record<string, number | undefined>
    /** Plugin lifecycle status, keyed by plugin ID. */
    status: Record<string, number>
}

export const pluginStore = createStore<PluginStoreState>(() => ({
    ids: [],
    sessionFlags: {},
    savedFlags: {},
    status: {},
}))

/** Tracks plugin, resetting status. Re-registration overwrites the previous entry. */
export function addPlugin(id: string, flags: number) {
    pluginStore.setState(state => ({
        ids: state.ids.includes(id) ? state.ids : [...state.ids, id],
        sessionFlags: { ...state.sessionFlags, [id]: flags },
        status: { ...state.status, [id]: 0 },
    }))
}

export function removePlugin(id: string) {
    pluginStore.setState(state => {
        const sessionFlags = { ...state.sessionFlags }
        const savedFlags = { ...state.savedFlags }
        const status = { ...state.status }
        delete sessionFlags[id]
        delete savedFlags[id]
        delete status[id]

        return {
            ids: state.ids.filter(other => other !== id),
            sessionFlags,
            savedFlags,
            status,
        }
    })
}

export function getSessionFlags(id: string): number {
    return pluginStore.getState().sessionFlags[id] ?? 0
}

export function setSessionFlags(id: string, flags: number) {
    pluginStore.setState(state => ({
        sessionFlags: { ...state.sessionFlags, [id]: flags },
    }))
}

/** Saved flags for a plugin, or `undefined` when the saved setup is not tracked separately. */
export function getSavedFlags(id: string): number | undefined {
    return pluginStore.getState().savedFlags[id]
}

export function setSavedFlags(id: string, flags: number) {
    pluginStore.setState(state => ({
        savedFlags: { ...state.savedFlags, [id]: flags },
    }))
}

// hydrated at boot
export function hydrateSavedFlags(flags: Record<string, number>) {
    pluginStore.setState({ savedFlags: flags })
}

export function getStatus(id: string): number {
    return pluginStore.getState().status[id] ?? 0
}

export function setStatus(id: string, status: number) {
    pluginStore.setState(state => ({
        status: { ...state.status, [id]: status },
    }))
}
