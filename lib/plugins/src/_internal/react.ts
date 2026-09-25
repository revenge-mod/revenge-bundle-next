// This should only be imported after start! Zustand imports React eagerly, our shim uses waitForModules.

import { useStore } from 'zustand/react'
import { PluginFlags } from './constants'
import { pluginStore, resolveFlags } from './store'
import type { AnyPlugin } from '.'

export function usePluginEnabledById(id: string): boolean {
    return useStore(pluginStore, state =>
        Boolean(resolveFlags(state, state.bootSlot, id) & PluginFlags.Enabled),
    )
}

export function usePluginEnabled(plugin: AnyPlugin): boolean {
    return usePluginEnabledById(plugin.manifest.id)
}

/**
 * Differs from {@link usePluginEnabled} only during a defaults-only boot,
 * where the session runs on plugin defaults while the UI shows and edits the chosen slot.
 */
export function usePluginEnabledInActiveSlot(plugin: AnyPlugin): boolean {
    const id = plugin.manifest.id
    return useStore(pluginStore, state =>
        Boolean(
            resolveFlags(state, state.activeSlot, id) & PluginFlags.Enabled,
        ),
    )
}

export function usePluginStatus(plugin: AnyPlugin): number {
    const id = plugin.manifest.id
    return useStore(pluginStore, state => state.status[id] ?? 0)
}

export function usePluginFlags(plugin: AnyPlugin): number {
    const id = plugin.manifest.id
    return useStore(pluginStore, state =>
        resolveFlags(state, state.bootSlot, id),
    )
}

/** Subscribes to registered plugin IDs, in registration order. */
export function usePluginIds(): string[] {
    return useStore(pluginStore, state => state.ids)
}

export function useEnabledPluginCountInActiveSlot(): number {
    return useStore(pluginStore, state => {
        let count = 0
        for (const id of state.ids)
            if (resolveFlags(state, state.activeSlot, id) & PluginFlags.Enabled)
                count++
        return count
    })
}
