// This should only be imported after start! Zustand imports React eagerly, our shim uses waitForModules.

import { useCallback, useSyncExternalStore } from 'react'
import { useStore } from 'zustand/react'
import { PluginFlags } from './constants'
import { pEmitter } from './emitter'
import { getInternalPluginMeta } from './registry'
import { pluginStore, resolveFlags } from './store'
import type { AnyPlugin, PluginSource } from '.'

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

export function useHasFlagPluginCount(flag: number): number {
    return useStore(pluginStore, state => {
        let count = 0
        for (const id of state.ids) {
            if (resolveFlags(state, state.bootSlot, id) & flag) count++
        }
        return count
    })
}

/** Subscribes to a plugin's install source, `undefined` for built-in plugins. */
export function usePluginSource(
    plugin: AnyPlugin,
): PluginSource | null | undefined {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const handler = (updated: AnyPlugin) => {
                if (updated === plugin) onChange()
            }

            pEmitter.on('metadataUpdate', handler)
            return () => {
                pEmitter.off('metadataUpdate', handler)
            }
        },
        [plugin],
    )

    return useSyncExternalStore(
        subscribe,
        () => getInternalPluginMeta(plugin).source,
    )
}
