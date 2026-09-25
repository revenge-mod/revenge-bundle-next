import { createStore } from 'zustand/vanilla'

/**
 * Reactive and observable source of truth for plugin flags and {@link Plugin.status}.
 *
 * @see {@link file://./react.ts} for React bindings
 *
 * @see {@link file://./state.ts}
 */

export interface PluginStoreState {
    /** Registered plugin IDs, in registration order. */
    ids: string[]
    /**
     * Flags of every plugin in every slot, keyed by slot ID then plugin ID.
     * Default to {@link PluginStoreState.defaultFlags} if no value.
     */
    slots: Record<string, Record<string, number | undefined>>
    /** Default flags of plugins keyed by plugin ID. */
    defaultFlags: Record<string, number>
    /** Slot the user chose. The UI reads and edits it. */
    activeSlot: string
    /** Slot this boot runs on. Same as {@link PluginStoreState.activeSlot} on a normal boot. */
    bootSlot: string
    /** Plugin lifecycle status, keyed by plugin ID. */
    status: Record<string, number>
}

export const pluginStore = createStore<PluginStoreState>(() => ({
    ids: [],
    slots: {},
    defaultFlags: {},
    activeSlot: '',
    bootSlot: '',
    status: {},
}))

export function hydrateSlots(
    slots: Record<string, Record<string, number | undefined>>,
    activeSlot: string,
    bootSlot: string,
) {
    pluginStore.setState({ slots, activeSlot, bootSlot })
}

/** Tracks a plugin, resetting status. Re-registration overwrites the previous entry. */
export function addPlugin(id: string, defaultFlags: number) {
    pluginStore.setState(state => ({
        ids: state.ids.includes(id) ? state.ids : [...state.ids, id],
        defaultFlags: { ...state.defaultFlags, [id]: defaultFlags },
        status: { ...state.status, [id]: 0 },
    }))
}

/** Drops the plugin from every slot, so a reinstall starts from its defaults. */
export function removePlugin(id: string) {
    pluginStore.setState(state => {
        const slots: PluginStoreState['slots'] = {}
        for (const slot in state.slots) {
            const flags = { ...state.slots[slot] }
            delete flags[id]
            slots[slot] = flags
        }

        const status = { ...state.status }
        delete status[id]

        const defaultFlags = { ...state.defaultFlags }
        delete defaultFlags[id]

        return {
            ids: state.ids.filter(other => other !== id),
            slots,
            defaultFlags,
            status,
        }
    })
}

/** Flags of a plugin in a slot, with fallback to the default flags. */
export function resolveFlags(
    state: PluginStoreState,
    slot: string,
    id: string,
): number {
    return state.slots[slot]?.[id] ?? state.defaultFlags[id] ?? 0
}

export function getFlags(slot: string, id: string): number {
    return resolveFlags(pluginStore.getState(), slot, id)
}

export function setFlags(slot: string, id: string, flags: number) {
    pluginStore.setState(state => ({
        slots: withFlags(state, slot, id, flags),
    }))
}

function withFlags(
    state: PluginStoreState,
    slot: string,
    id: string,
    flags: number,
): PluginStoreState['slots'] {
    return {
        ...state.slots,
        [slot]: { ...state.slots[slot], [id]: flags },
    }
}

export function getStatus(id: string): number {
    return pluginStore.getState().status[id] ?? 0
}

export function setStatus(id: string, status: number) {
    pluginStore.setState(state => ({
        status: { ...state.status, [id]: status },
    }))
}
