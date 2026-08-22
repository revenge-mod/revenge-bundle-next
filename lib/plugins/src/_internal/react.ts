// This should only be imported after start! Zustand imports React eagerly, our shim uses waitForModules.

import { useStore } from 'zustand/react'
import { PluginFlags } from './constants'
import { pluginStore } from './store'
import type { AnyPlugin } from '.'

export function usePluginEnabledById(id: string): boolean {
    return useStore(pluginStore, state =>
        Boolean((state.sessionFlags[id] ?? 0) & PluginFlags.Enabled),
    )
}

export function usePluginEnabled(plugin: AnyPlugin): boolean {
    return usePluginEnabledById(plugin.manifest.id)
}

export function usePluginEnabledInSavedStates(plugin: AnyPlugin): boolean {
    const id = plugin.manifest.id
    return useStore(pluginStore, state =>
        Boolean(
            (state.savedFlags[id] ?? state.sessionFlags[id] ?? 0) &
                PluginFlags.Enabled,
        ),
    )
}

export function usePluginStatus(plugin: AnyPlugin): number {
    const id = plugin.manifest.id
    return useStore(pluginStore, state => state.status[id] ?? 0)
}

export function usePluginFlags(plugin: AnyPlugin): number {
    const id = plugin.manifest.id
    return useStore(pluginStore, state => state.sessionFlags[id] ?? 0)
}

/** Subscribes to registered plugin IDs, in registration order. */
export function usePluginIds(): string[] {
    return useStore(pluginStore, state => state.ids)
}

export function useEnabledPluginCount(): number {
    return useStore(pluginStore, state => {
        let count = 0
        for (const id of state.ids)
            if ((state.sessionFlags[id] ?? 0) & PluginFlags.Enabled) count++
        return count
    })
}
