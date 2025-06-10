import { getStorage } from '@revenge-mod/storage'
import { defineLazyProperty } from '@revenge-mod/utils/objects'
import { allSettled, sleepReject } from '@revenge-mod/utils/promises'
import { _uapi as uapi } from './apis'
import {
    PluginFlags as Flag,
    PluginsStorageDirectory,
    PluginStatus as Status,
} from './constants'
import type { StorageOptions } from '@revenge-mod/storage'
import type { AnyObject } from '@revenge-mod/utils/types'
import type {
    InitPluginApi,
    Plugin,
    PluginApi,
    PluginCleanup,
    PluginManifest,
    PluginOptions,
    PreInitPluginApi,
} from './types'

export const _uapi = uapi

export const _preInitExts: Array<
    (api: PreInitPluginApi, plugin: InternalPlugin) => void
> = []
export const _initExts: Array<
    (api: InitPluginApi, plugin: InternalPlugin) => void
> = []
export const _startExts: Array<
    (api: PluginApi, plugin: InternalPlugin) => void
> = []

export const _plugins = new Map<PluginManifest['id'], InternalPlugin>()
export const _metas = new Map<
    PluginManifest['id'],
    [
        api: PreInitPluginApi | InitPluginApi | PluginApi | undefined,
        promises: Promise<void>[],
        iflags: number,
        apiLevel: number,
    ]
>()

export function registerPlugin<S extends AnyObject = AnyObject>(
    manifest: PluginManifest,
    options: PluginOptions<S>,
    flags: number,
    iflags: number,
) {
    // TODO(plugins): verify plugin manifest
    if (_plugins.has(manifest.id))
        throw new Error(`Plugin with ID "${manifest.id}" already registered`)

    const plugin: InternalPlugin = {
        _c: [],
        _s: options.storage,
        errors: [],
        manifest,
        lifecycles: {
            preInit: options.preInit,
            init: options.init,
            start: options.start,
            stop: options.stop,
        },
        SettingsComponent: options.SettingsComponent,
        status: 0,
        flags,
        disable: () => disablePlugin(plugin),
        stop: () => stopPlugin(plugin),
    }

    _metas.set(manifest.id, [undefined, [], iflags, PluginApiLevel.None])
    _plugins.set(manifest.id, plugin)
}

function handlePluginError(e: unknown, plugin: InternalPlugin) {
    plugin.errors.push(e)
    plugin.flags |= Flag.Errored
    const [api, , iflags] = _metas.get(plugin.manifest.id)!

    const log = (api as InitPluginApi).logger ?? console
    log.error('Plugin encountered an error', e)

    if (!(iflags & InternalPluginFlags.Essential)) return plugin.disable()
}

function preparePluginPreInit(plugin: InternalPlugin) {
    const meta = _metas.get(plugin.manifest.id)!

    // Clear errors from previous runs
    plugin.errors = []
    plugin.status &= ~Flag.Errored

    const api = (meta[0] = {
        cleanup: (...items) => {
            plugin._c.push(...items)
        },
        plugin,
        unscoped: _uapi,
    })

    for (const ext of _preInitExts) ext(api, plugin)

    meta[3] = PluginApiLevel.PreInit
}

function preparePluginInit(plugin: InternalPlugin) {
    const meta = _metas.get(plugin.manifest.id)!
    const api = meta[0] as InitPluginApi

    defineLazyProperty(api, 'storage', () =>
        getStorage(`${PluginsStorageDirectory}/${plugin.manifest.id}.json`, {
            ...plugin._s,
            directory: 'documents',
        }),
    )

    for (const ext of _initExts) ext(api, plugin)

    meta[3] = PluginApiLevel.Init
}

function preparePluginStart(plugin: InternalPlugin) {
    const meta = _metas.get(plugin.manifest.id)!

    const api = meta[0] as PluginApi
    // api.settings = ...

    for (const ext of _startExts) ext(api, plugin)

    meta[3] = PluginApiLevel.Start
}

async function disablePlugin(plugin: InternalPlugin) {
    const iflags = _metas.get(plugin.manifest.id)![2] ?? 0
    if (iflags & InternalPluginFlags.Essential)
        throw new Error(
            `Plugin "${plugin.manifest.id}" is essential and cannot be disabled`,
        )

    // If plugin is not stopped, and is also not stopping, we need to stop it
    if (plugin.status && !(plugin.status & Status.Stopping))
        await stopPlugin(plugin)

    // TODO(plugins): write to storage
    plugin.flags &= ~Flag.Enabled
}

export function enablePlugin(plugin: InternalPlugin, late: boolean) {
    // TODO(plugins): write to storage
    plugin.flags |= Flag.Enabled
    if (late) plugin.flags |= Flag.EnabledLate
}

export async function preInitPlugin(plugin: InternalPlugin) {
    const {
        manifest: { id },
        lifecycles,
    } = plugin
    if (!lifecycles.preInit) return

    const meta = _metas.get(id)!
    const [, promises] = meta

    preparePluginPreInit(plugin)

    if (!(plugin.flags & Flag.Enabled))
        throw new Error(`Plugin "${id}" is not enabled`)
    if (plugin.status & (Status.PreIniting | Status.PreInited))
        throw new Error(
            `Plugin preInit lifecycle for "${id}" is already running`,
        )

    plugin.status |= Status.PreIniting

    try {
        const prom = lifecycles.preInit(meta[0] as PreInitPluginApi)
        promises.push(prom)
        await prom

        // plugin.disable() already handles, so it's in the try block
        plugin.status |= Status.PreInited
        plugin.status &= ~Status.PreIniting
    } catch (e) {
        await handlePluginError(e, plugin)
    }
}

export async function initPlugin(plugin: InternalPlugin) {
    const {
        manifest: { id },
        lifecycles,
    } = plugin
    if (!lifecycles.init) return

    const meta = _metas.get(id)!
    const [, promises, , apiLevel] = meta

    if (!(plugin.flags & Flag.Enabled))
        throw new Error(`Plugin "${id}" is not enabled`)
    if (plugin.status & (Status.Initing | Status.Inited))
        throw new Error(`Plugin init lifecycle for "${id}" is already running`)

    if (apiLevel < PluginApiLevel.PreInit) preparePluginPreInit(plugin)
    if (apiLevel < PluginApiLevel.Init) preparePluginInit(plugin)

    try {
        const prom = lifecycles.init(meta[0] as InitPluginApi)
        promises.push(prom)
        await prom

        // plugin.disable() already handles, so it's in the try block
        plugin.status |= Status.Inited
        plugin.status &= ~Status.Initing
    } catch (e) {
        await handlePluginError(e, plugin)
    }
}

export async function startPlugin(plugin: InternalPlugin) {
    const {
        manifest: { id },
        lifecycles,
    } = plugin
    if (!lifecycles.start) return

    const meta = _metas.get(id)!
    const [, promises, , apiLevel] = meta

    if (!(plugin.flags & Flag.Enabled))
        throw new Error(`Plugin "${id}" is not enabled`)
    if (plugin.status & (Status.Starting | Status.Started))
        throw new Error(`Plugin start lifecycle for "${id}" is already running`)

    plugin.status |= Status.Starting

    if (apiLevel < PluginApiLevel.PreInit) preparePluginPreInit(plugin)
    if (apiLevel < PluginApiLevel.Init) preparePluginInit(plugin)
    if (apiLevel < PluginApiLevel.Start) preparePluginStart(plugin)

    try {
        const prom = lifecycles.start(meta[0] as PluginApi)
        promises.push(prom)
        await prom

        // disablePlugin() already handles cleaning up statuses, so it's in the try block
        plugin.status |= Status.Started
        plugin.status &= ~Status.Starting
    } catch (e) {
        await handlePluginError(e, plugin)
    }
}

const MaxWaitTime = 5000

export async function stopPlugin(plugin: InternalPlugin) {
    const {
        manifest: { id },
        lifecycles,
    } = plugin
    const meta = _metas.get(id)!
    const [, promises, iflags, apiLevel] = meta

    if (iflags & InternalPluginFlags.Essential)
        throw new Error(`Plugin "${id}" is essential and cannot be stopped`)

    if (!(plugin.flags & Flag.Enabled))
        throw new Error(`Plugin "${id}" is not enabled`)
    if (plugin.status & Status.Stopping)
        throw new Error(`Plugin "${id}" is stopping`)

    // If the plugin is running its lifecycles, we need to wait for it to finish, then we'll stop it
    // We want to wait at max 5 seconds for the lifecycles to finish
    if (plugin.status & (Status.PreIniting | Status.Initing | Status.Starting))
        await Promise.race([
            Promise.all(promises),
            sleepReject(
                MaxWaitTime,
                'Plugin lifecycles timed out, force stopping',
            ),
        ])
            .then(finished => {
                // If the lifecycles don't finish in 5 seconds, a reload is probably required to unapply the changes
                if (!finished) plugin.flags |= Flag.ReloadRequired
            })
            .catch(e => handlePluginError(e, plugin))
    else if (
        !(plugin.status & (Status.PreInited | Status.Inited | Status.Started))
    )
        throw new Error(`Plugin "${id}" is not running`)

    if (apiLevel < PluginApiLevel.PreInit) preparePluginPreInit(plugin)
    if (apiLevel < PluginApiLevel.Init) preparePluginInit(plugin)
    if (apiLevel < PluginApiLevel.Start) preparePluginStart(plugin)

    plugin.status |= Status.Stopping

    try {
        if (lifecycles.stop)
            await Promise.race([
                lifecycles.stop(meta[0] as PluginApi),
                sleepReject(
                    MaxWaitTime,
                    'Plugin stop lifecycle timed out, force stopping',
                ),
            ])
    } catch (e) {
        await handlePluginError(e, plugin)
    } finally {
        // Run cleanups
        const results = await allSettled(plugin._c.map(cleanup => cleanup()))
        for (const result of results)
            if (result.status === 'rejected') {
                await handlePluginError(result.reason, plugin)
                // Some cleanup was unsuccessful, so we need to reload the app
                plugin.flags |= Flag.ReloadRequired
            }

        // Reset APIs
        meta[0] = undefined
        meta[3] = PluginApiLevel.None

        // Clear temp data
        meta[1] = []
        plugin._c = []

        // Reset status
        plugin.status = 0
    }
}

export interface InternalPlugin extends Plugin {
    _s?: StorageOptions<AnyObject>
    _c: PluginCleanup[]
}

export const InternalPluginFlags = {
    /**
     * Marks the plugin as internal.
     */
    Internal: 1 << 0,
    /**
     * Marks the plugin as essential. This means it should not be removed, disabled, or stopped by normal means.
     */
    Essential: 1 << 1,
}

const PluginApiLevel = {
    None: 0,
    PreInit: 1,
    Init: 2,
    Start: 3,
} as const
