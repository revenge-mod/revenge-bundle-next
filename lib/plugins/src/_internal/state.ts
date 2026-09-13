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
import {
    defaultsOnlySlot,
    PluginFlags,
    PluginStatus as Status,
} from './constants'
import { pEmitter } from './emitter'
import { stopPlugin } from './lifecycles'
import { callPluginSystemMethod, callPluginSystemMethodSync } from './native'
import { getInternalPluginMeta, pList } from './registry'
import * as store from './store'
import type { Plugin, PluginManifest } from '../types'
import type { PluginSystemErrorPayload } from './errors'
import type { AnyPlugin, PluginSlotStates, PluginStateObject } from './types'

const Flag = PluginFlags
/** Flags native persists, so a push from it is the whole answer for them. */
const PersistedFlags = Flag.Enabled | Flag.RequiredByUser

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

export const BootStates = slotStates[BootSlot]

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

/** Removes a snapshotted boot state, allowing reinstalled plugin to register with default state. */
export function forgetBootPluginState(id: PluginManifest['id']) {
    delete BootStates[id]
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

    if (slot === BootSlot) applyBootFlags(id as PluginManifest['id'], flags)
    else applySlotFlags(slot as string, id as PluginManifest['id'], flags)
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

/**
 * Applies boot flags to a plugin. If the plugin is running, it may be stopped if it is being disabled.
 * Flags that are not persisted in native (JS-only flags) are preserved.
 */
export async function applyBootFlags(id: PluginManifest['id'], flags: number) {
    const plugin = pList.get(id)
    if (!plugin) return

    const meta = getInternalPluginMeta(plugin)
    flags = (meta.flags & ~PersistedFlags) | flags
    if (meta.flags === flags) return

    const wasEnabled = meta.flags & Flag.Enabled
    const nowEnabled = flags & Flag.Enabled

    if (wasEnabled && !nowEnabled)
        if (meta.status && !(meta.status & Status.Stopping))
            await stopPlugin(plugin)

    // State update is handled in the meta.flags setter
    meta.flags = flags
}

/** Applies flags to a plugin in a specific slot. */
export function applySlotFlags(
    slot: string,
    id: PluginManifest['id'],
    flags: number,
) {
    const plugin = pList.get(id)
    if (!plugin) return
    if (store.getFlags(slot, id) === flags) return

    store.setFlags(slot, id, flags)
    pEmitter.emit('stateUpdate', plugin)
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
        'revenge.plugins.startNative': [[id: PluginManifest['id']], null]
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
