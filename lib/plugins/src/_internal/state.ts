/**
 * Two things are tracked separately:
 * - saved: what is on disk, and what applies on the next boot. The UI edits this.
 * - session: what is true for the plugins running right now.
 *
 * On a normal boot they are the same thing. During a defaults-only boot the session runs on defaults.
 * Each states have different apply functions and listeners.
 */

import { registerJSMethod } from '@revenge-mod/modules/native'
import { exists, rm } from '@revenge-mod/modules/native/fs'
import { pluginStorageDirFor } from '../constants'
import { PluginFlags, PluginStatus as Status } from './constants'
import { pEmitter } from './emitter'
import { stopPlugin } from './lifecycles'
import { callPluginSystemMethod, callPluginSystemMethodSync } from './native'
import { isPluginEnabled } from './predicates'
import { getInternalPluginMeta, pList } from './registry'
import * as store from './store'
import type { Plugin, PluginManifest } from '../types'
import type { PluginSystemErrorPayload } from './errors'
import type {
    AnyPlugin,
    PersistedPluginStates,
    PluginStateObject,
} from './types'

const Flag = PluginFlags
/** Flags sent from native that should be persisted. */
const PersistedFlags = Flag.Enabled | Flag.RequiredByUser

const SessionStateMethod = 'revenge.plugins.states.update'
const SavedStateMethod = 'revenge.plugins.states.updateSaved'

const persisted: PersistedPluginStates = callPluginSystemMethodSync(
    'revenge.plugins.states.read',
    [],
)

export const InitialPersistedStates = persisted.states
/** Whether boot ignores saved states to load default plugins only. */
export const isDefaultsOnlyBoot = persisted.savedStates != null

export function isPluginEnabledInSavedStates(plugin: AnyPlugin): boolean {
    const saved = store.getSavedFlags(plugin.manifest.id)
    return saved === undefined
        ? isPluginEnabled(plugin)
        : Boolean(saved & Flag.Enabled)
}

/** Removes boot snapshot entry, allowing reinstalled plugin to register with default state. */
export function forgetInitialPluginState(id: PluginManifest['id']) {
    delete InitialPersistedStates[id]
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

// The saved setup is reactive, so the UI re-renders when it changes during a defaults-only boot.
if (persisted.savedStates) {
    const saved: Record<string, number> = {}
    for (const id in persisted.savedStates)
        saved[id] = pluginStateToFlags(persisted.savedStates[id]!)

    store.hydrateSavedFlags(saved)
}

registerJSMethod(SessionStateMethod, (id, state) => {
    applySessionFlags(
        id as PluginManifest['id'],
        pluginStateToFlags(state as PluginStateObject),
    )
})

registerJSMethod(SavedStateMethod, (id, state) => {
    const flags = pluginStateToFlags(state as PluginStateObject)

    if (isDefaultsOnlyBoot) applySavedFlags(id as PluginManifest['id'], flags)
    // Outside a defaults-only boot, session == saved
    else applySessionFlags(id as PluginManifest['id'], flags)
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

async function applySessionFlags(id: PluginManifest['id'], flags: number) {
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

    meta.flags = flags
}

function applySavedFlags(id: PluginManifest['id'], flags: number) {
    const plugin = pList.get(id)
    if (!plugin) return
    if (store.getSavedFlags(id) === flags) return

    store.setSavedFlags(id, flags)
    pEmitter.emit('stateUpdate', plugin)
}

/**
 * Persists enabled state to native and syncs saved states.
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

    // Copy what native just persisted, so the UI follows the saved setup, not the session
    if (isDefaultsOnlyBoot)
        store.setSavedFlags(
            plugin.manifest.id,
            enabled
                ? Flag.Enabled | (requiredByUser ? Flag.RequiredByUser : 0)
                : 0,
        )
}

/** Deletes plugin storage directory on filesystem. */
export async function deleteStorageForPlugin(plugin: Plugin<any, any>) {
    const dir = pluginStorageDirFor(plugin.manifest.id)

    if (await exists(dir)) await rm(dir)
}

/** Requests defaults-only mode for subsequent boot. */
export function requestNextBootDefaultsOnly() {
    callPluginSystemMethodSync(
        'revenge.plugins.states.requestNextBootDefaultsOnly',
        [],
    )
}

declare module '@revenge-mod/modules/native' {
    interface NativeMethods {
        'revenge.plugins.startNative': [[id: PluginManifest['id']], null]
        'revenge.plugins.states.read': [[], PersistedPluginStates]
        'revenge.plugins.states.requestNextBootDefaultsOnly': [[], void]
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
        /** JS reporting the flags of a running plugin. Answers with them. */
        'revenge.plugins.states.update': [
            [id: PluginManifest['id'], state: PluginStateObject],
            PluginStateObject,
        ]
    }
}
