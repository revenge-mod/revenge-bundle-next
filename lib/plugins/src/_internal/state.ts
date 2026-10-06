/**
 * Plugin flags, per slot.
 *
 * A slot is a named set of plugin flags:
 * - {@link ActiveSlot}: the slot the user chose. The UI reads and edits it.
 * - {@link BootSlot}: the slot this boot runs on. `meta.flags` of a running plugin is this one.
 *
 * Both IDs are the same on a normal boot. However, a defaults-only boot sets {@link BootSlot} to an ephemeral slot.
 */

import { registerJSMethod } from '@revenge-mod/modules/native'
import { exists, rm } from '@revenge-mod/modules/native/fs'
import { pluginStorageDirFor } from '../constants'
import { defaultsOnlySlot, PluginFlags } from './constants'
import { pEmitter } from './emitter'
import { callPluginSystemMethod, callPluginSystemMethodSync } from './native'
import { getInternalPluginMeta, pList } from './registry'
import * as store from './store'
import type { Plugin, PluginManifest } from '../types'
import type { PluginSystemErrorPayload } from './errors'
import type { AnyPlugin, PluginSlotStates, PluginStateObject } from './types'

const Flag = PluginFlags
/** Flags native persists. */
const PersistedFlags = Flag.Enabled | Flag.RequiredByUser
/** Flags {@link PluginStateObject} can send over. */
const WireFlags = PersistedFlags | Flag.PendingReload | Flag.StartedLate

const StateUpdateMethod = 'revenge.plugins.states.update'

const slotInfo = callPluginSystemMethodSync(
    'revenge.plugins.states.getSlots',
    [],
)
const slotStates: PluginSlotStates = callPluginSystemMethodSync(
    'revenge.plugins.states.read',
    [],
)

/** Slot the user chose. The UI reads and edits it. */
export const ActiveSlot = slotInfo.active
/** Slot this boot runs on. */
export const BootSlot = slotInfo.oneShot ?? slotInfo.active
/** Whether boot ignores the chosen slot to load default plugins only. */
export const isDefaultsOnlyBoot = BootSlot === defaultsOnlySlot

/// HYDRATION

const hydrated: Record<string, Record<string, number>> = {}
for (const slot in slotStates) {
    const flags: Record<string, number> = {}
    for (const id in slotStates[slot])
        flags[id] = pluginStateToFlags(slotStates[slot]![id]!)
    hydrated[slot] = flags
}
hydrated[ActiveSlot] ??= {}
hydrated[BootSlot] ??= {}
store.hydrateSlots(hydrated, ActiveSlot, BootSlot)

/// METHODS

export function isPluginEnabledInActiveSlot(plugin: AnyPlugin): boolean {
    return Boolean(
        store.getFlags(ActiveSlot, plugin.manifest.id) & Flag.Enabled,
    )
}

export function pluginStateToFlags(state: PluginStateObject): number {
    return (
        (state.enabled ? Flag.Enabled : 0) |
        (state.pendingReload ? Flag.PendingReload : 0) |
        (state.startedLate ? Flag.StartedLate : 0) |
        (state.requiredByUser ? Flag.RequiredByUser : 0)
    )
}

export function flagsToPluginState(flags: number): PluginStateObject {
    return {
        enabled: Boolean(flags & Flag.Enabled),
        pendingReload: Boolean(flags & Flag.PendingReload),
        startedLate: Boolean(flags & Flag.StartedLate),
        requiredByUser: Boolean(flags & Flag.RequiredByUser),
    }
}

/// EVENTS

registerJSMethod(StateUpdateMethod, (slot, id, state) => {
    const flags = pluginStateToFlags(state as PluginStateObject)

    if (slot === BootSlot)
        applyFlagsFromNative(id as PluginManifest['id'], flags)
    else adoptSlotFlags(slot as string, id as PluginManifest['id'], flags)
})

registerJSMethod(
    'revenge.plugins.events.pluginErrored',
    (id: string, errors: PluginSystemErrorPayload[]) => {
        const plugin = pList.get(id)
        if (!plugin) return

        getInternalPluginMeta(plugin).nativeErrors = Object.freeze(errors)
        pEmitter.emit('metadataUpdate', plugin)
    },
)

/** Applies flags from native to a plugin. Flags native cannot send are preserved. */
function applyFlagsFromNative(id: PluginManifest['id'], flags: number) {
    const plugin = pList.get(id)
    if (!plugin) return

    adoptSlotFlags(
        BootSlot,
        id,
        (getInternalPluginMeta(plugin).flags & ~WireFlags) | flags,
    )
}

/** Applies flags to a plugin in a specific slot. */
export function adoptSlotFlags(
    slot: string,
    id: PluginManifest['id'],
    flags: number,
) {
    const plugin = pList.get(id)
    if (!plugin) return
    if (!store.setFlags(slot, id, flags)) return

    pEmitter.emit('stateUpdate', plugin)
}

/** Adds flags and reports them to native. */
export function addPluginFlags(plugin: AnyPlugin, flags: number) {
    const { id } = plugin.manifest
    const current = getInternalPluginMeta(plugin).flags
    const next = current | flags

    if (next === current) return

    if ((next & WireFlags) === (current & WireFlags)) {
        adoptSlotFlags(BootSlot, id, next)
        return
    }

    const answer = callPluginSystemMethodSync(StateUpdateMethod, [
        BootSlot,
        id,
        flagsToPluginState(next),
    ])

    adoptSlotFlags(
        BootSlot,
        id,
        (next & ~WireFlags) | pluginStateToFlags(answer),
    )
}

/** Adds flags native has already set, or is setting as part of a call in-flight. */
export function adoptPluginFlags(plugin: AnyPlugin, flags: number) {
    const { id } = plugin.manifest
    adoptSlotFlags(BootSlot, id, getInternalPluginMeta(plugin).flags | flags)
}

/**
 * Persists enabled state to native.
 *
 * Throws `PluginSystemError` when native rejects state change (e.g. `DEPENDENCIES_UNSATISFIED`).
 */
export async function writePluginEnabledState(
    plugin: AnyPlugin,
    enabled: boolean,
    requiredByUser: boolean,
) {
    await callPluginSystemMethod('revenge.plugins.setEnabled', [
        plugin.manifest.id,
        enabled,
        requiredByUser,
    ])
}

/** Deletes plugin storage directory on filesystem. */
export async function deleteStorageForPlugin(plugin: Plugin<any, any>) {
    const dir = pluginStorageDirFor(plugin.manifest.id)

    if (await exists(dir)) await rm(dir)
}

/**
 * Selects the slot for the next boot.
 *
 * @param oneShot Applies to the next boot only.
 */
export function setActiveSlot(slot: string, oneShot?: boolean) {
    callPluginSystemMethodSync('revenge.plugins.states.setActiveSlot', [
        slot,
        oneShot,
    ])
}

/** Requests defaults-only mode for subsequent boot. */
export function requestNextBootDefaultsOnly() {
    setActiveSlot(defaultsOnlySlot, true)
}

declare module '@revenge-mod/modules/native' {
    interface NativeMethods {
        /**
         * Starts a plugin's native half, stopping it first if it is running.
         * Throws with `RELOAD_REQUIRED` when the stop could not undo the plugin cleanly.
         */
        'revenge.plugins.restart': [[id: PluginManifest['id']], null]
        /** Stops a plugin's native half. */
        'revenge.plugins.stop': [[id: PluginManifest['id']], null]
        /** Flags of every loaded slot. */
        'revenge.plugins.states.read': [[], PluginSlotStates]
        'revenge.plugins.states.getSlots': [
            [],
            { active: string; oneShot?: string; slots: string[] },
        ]
        'revenge.plugins.states.setActiveSlot': [
            [slot: string, oneShot?: boolean],
            null,
        ]
        /**
         * Persists plugin enabled state. Rejects with `DEPENDENCIES_UNSATISFIED` when required
         * dependencies are missing, disabled, or incompatible.
         */
        'revenge.plugins.setEnabled': [
            [
                id: PluginManifest['id'],
                enabled: boolean,
                requiredByUser: boolean,
            ],
            null,
        ]
        /** JS reporting the flags it changed in a slot. Answers with them. */
        'revenge.plugins.states.update': [
            [slot: string, id: PluginManifest['id'], state: PluginStateObject],
            PluginStateObject,
        ]
    }
}
