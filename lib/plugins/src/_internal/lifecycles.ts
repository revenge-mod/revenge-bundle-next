import { getErrorStack } from '@revenge-mod/utils/error'
import { sleepReject } from '@revenge-mod/utils/promise'
import { pUnscopedApi as uapi } from '../apis'
import {
    MaxStopWaitTime,
    PluginApiLevel,
    PluginFlags,
    PluginStatus as Status,
} from './constants'
import {
    addPluginApiDecorator,
    decoratePluginApi,
    pDecoratorsInit,
    pDecoratorsPreInit,
    pDecoratorsStart,
} from './decorators'
import { getPluginDependencies, getPluginDependents } from './dependencies'
import { computePendingNodes, pListOrdered, pPending } from './dependency-graph'
import {
    formatPluginSystemErrorPayload,
    isPluginSystemErrorPayload,
} from './errors'
import { callPluginSystemMethod } from './native'
import {
    isPluginEnabled,
    isPluginErrored,
    isPluginEssential,
    isPluginStopped,
    requirePluginStartableState,
} from './predicates'
import { getInternalPluginMeta } from './registry'
import {
    isDefaultsOnlyBoot,
    isPluginEnabledInSavedStates,
    writePluginEnabledState,
} from './state'
import type { InitPluginApi, PluginApi, PreInitPluginApi } from '../types'
import type { AnyPlugin, InternalPluginMeta } from './types'

/** Handles plugin runtime error, logs diagnostics, and disables non-essential plugin if {@link critical}. */
export async function handlePluginError(
    e: unknown,
    plugin: AnyPlugin,
    critical: boolean,
) {
    ;(plugin.errors as unknown[]).push(e)

    nativeLoggingHook(
        `\u001b[31mPlugin "${plugin.manifest.id}" encountered an error: ${
            isPluginSystemErrorPayload(e)
                ? formatPluginSystemErrorPayload(e)
                : getErrorStack(e)
        }\u001b[0m`,
        2,
    )

    plugin.api?.logger?.error('Plugin encountered an error', e)

    if (
        critical &&
        !isPluginEssential(getInternalPluginMeta(plugin)) &&
        isPluginEnabled(plugin)
    )
        await plugin.disable()
}

function resolvePluginOptions(plugin: AnyPlugin, meta: InternalPluginMeta) {
    const { optionsFactory } = meta
    if (!optionsFactory) return

    meta.optionsFactory = undefined

    try {
        const options = optionsFactory()

        meta.options = options
        plugin.lifecycles.preInit = options.preInit
        plugin.lifecycles.init = options.init
        plugin.lifecycles.start = options.start
        plugin.lifecycles.stop = options.stop
        plugin.SettingsComponent = options.SettingsComponent
    } catch (e) {
        meta.handleError(e)
    }
}

function tryPreparePluginPreInit(plugin: AnyPlugin) {
    const meta = getInternalPluginMeta(plugin)
    if (meta.apiLevel >= PluginApiLevel.PreInit) return

    plugin.errors = []

    resolvePluginOptions(plugin, meta)

    plugin.api = {
        cleanup: (...items) => {
            meta.cleanups.push(...items)
        },
        plugin,
        unscoped: uapi,
        decorate: decorator => {
            addPluginApiDecorator(pDecoratorsPreInit, plugin, decorator)
        },
    } satisfies PreInitPluginApi

    decoratePluginApi(pDecoratorsPreInit, plugin, meta)
    meta.apiLevel = PluginApiLevel.PreInit
}

function tryPreparePluginInit(plugin: AnyPlugin) {
    const meta = getInternalPluginMeta(plugin)
    if (meta.apiLevel >= PluginApiLevel.Init) return

    const api = plugin.api as InitPluginApi

    api.decorate = decorator => {
        addPluginApiDecorator(pDecoratorsInit, plugin, decorator)
    }

    decoratePluginApi(pDecoratorsInit, plugin, meta)
    meta.apiLevel = PluginApiLevel.Init
}

function tryPreparePluginStart(plugin: AnyPlugin) {
    const meta = getInternalPluginMeta(plugin)
    if (meta.apiLevel >= PluginApiLevel.Start) return

    const api = plugin.api as PluginApi

    api.decorate = decorator => {
        addPluginApiDecorator(pDecoratorsStart, plugin, decorator)
    }

    decoratePluginApi(pDecoratorsStart, plugin, meta)
    meta.apiLevel = PluginApiLevel.Start
}

/** Disables plugin, cascading stop and disable to dependents. */
export async function disablePlugin(plugin: AnyPlugin) {
    if (!isPluginEnabledInSavedStates(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" is not enabled`)

    const meta = getInternalPluginMeta(plugin)

    if (isPluginEssential(meta))
        throw new Error(
            `Plugin "${plugin.manifest.id}" is essential and cannot be disabled`,
        )

    await Promise.all(
        getPluginDependents(plugin).map(dep => {
            if (isPluginEnabledInSavedStates(dep)) return disablePlugin(dep)
        }),
    )

    if (meta.status && !(meta.status & Status.Stopping))
        await stopPlugin(plugin)

    await writePluginEnabledState(plugin, false, false)

    meta.flags &= ~PluginFlags.Enabled
}

/** Enables plugin after ensuring required dependencies are enabled. */
export async function enablePlugin(plugin: AnyPlugin, requiredByUser: boolean) {
    if (isPluginEnabledInSavedStates(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" is already enabled`)

    await Promise.all(
        getPluginDependencies(plugin).map(dep => {
            if (!isPluginEnabledInSavedStates(dep))
                return enablePlugin(dep, false)
        }),
    )

    await writePluginEnabledState(plugin, true, requiredByUser)

    getInternalPluginMeta(plugin).flags |= PluginFlags.Enabled
}

/** Starts plugin and unresolved dependencies after initial boot sequence. */
export async function runPluginLate(plugin: AnyPlugin) {
    if (isDefaultsOnlyBoot)
        throw new Error(
            `Cannot start plugin "${plugin.manifest.id}" while running with default plugins. Reload to apply your changes.`,
        )

    requirePluginStartableState(plugin)

    const meta = getInternalPluginMeta(plugin)
    if (meta.status & Status.Started)
        throw new Error(`Plugin "${plugin.manifest.id}" is already started`)

    pListOrdered.length = 0
    pPending.add(plugin)
    computePendingNodes()

    await Promise.all(
        pListOrdered
            .filter(plugin => isPluginStopped(plugin))
            .map(async function runLate(plugin) {
                getInternalPluginMeta(plugin).flags |= PluginFlags.StartedLate

                await callPluginSystemMethod('revenge.plugins.startNative', [
                    plugin.manifest.id,
                ])

                await preInitPlugin(plugin)
                await initPlugin(plugin)
                await startPlugin(plugin)
            }),
    )
}

export async function preInitPlugin(plugin: AnyPlugin) {
    requirePluginStartableState(plugin)

    const {
        manifest: { id },
    } = plugin

    const meta = getInternalPluginMeta(plugin)

    if (meta.status & (Status.PreIniting | Status.PreInited))
        throw new Error(
            `Plugin preInit lifecycle for "${id}" is already running`,
        )

    tryPreparePluginPreInit(plugin)

    const { lifecycles } = plugin
    const { promises, handleError } = getInternalPluginMeta(plugin)

    try {
        if (!lifecycles.preInit) return

        meta.status |= Status.PreIniting

        try {
            const prom = lifecycles.preInit.apply(plugin, [
                plugin.api as PreInitPluginApi,
            ])
            promises.push(prom)
            await prom
        } catch (e) {
            await handleError(e)
        } finally {
            meta.status &= ~Status.PreIniting
        }
    } finally {
        if (!isPluginErrored(plugin)) {
            meta.status |= Status.PreInited
        }
    }
}

export async function initPlugin(plugin: AnyPlugin) {
    requirePluginStartableState(plugin)

    const {
        manifest: { id },
    } = plugin

    const meta = getInternalPluginMeta(plugin)

    if (meta.status & (Status.Initing | Status.Inited))
        throw new Error(`Plugin init lifecycle for "${id}" is already running`)

    tryPreparePluginPreInit(plugin)
    tryPreparePluginInit(plugin)

    const { lifecycles } = plugin
    const { promises, handleError } = meta

    try {
        if (!lifecycles.init) return

        meta.status |= Status.Initing

        try {
            const prom = lifecycles.init.apply(plugin, [
                plugin.api as InitPluginApi,
            ])
            promises.push(prom)
            await prom
        } catch (e) {
            await handleError(e)
        } finally {
            meta.status &= ~Status.Initing
        }
    } finally {
        if (!isPluginErrored(plugin)) {
            meta.status |= Status.Inited
        }
    }
}

export async function startPlugin(plugin: AnyPlugin) {
    requirePluginStartableState(plugin)

    const {
        manifest: { id },
    } = plugin

    const meta = getInternalPluginMeta(plugin)

    if (meta.status & (Status.Starting | Status.Started))
        throw new Error(`Plugin start lifecycle for "${id}" is already running`)

    tryPreparePluginPreInit(plugin)
    tryPreparePluginInit(plugin)
    tryPreparePluginStart(plugin)

    const { lifecycles } = plugin
    const { promises, handleError } = getInternalPluginMeta(plugin)

    try {
        if (!lifecycles.start) return

        meta.status |= Status.Starting

        try {
            const prom = lifecycles.start.apply(plugin, [
                plugin.api as PluginApi,
            ])
            promises.push(prom)
            await prom
        } catch (e) {
            await handleError(e)
        } finally {
            meta.status &= ~Status.Starting
        }
    } finally {
        if (!isPluginErrored(plugin)) {
            meta.status |= Status.Started
        }
    }
}

/** Stops running plugin, cascading stop to dependents and executing cleanups. */
export async function stopPlugin(plugin: AnyPlugin) {
    if (!isPluginEnabled(plugin))
        throw new Error(`Plugin "${plugin.manifest.id}" is not enabled`)

    const {
        manifest: { id },
    } = plugin

    const meta = getInternalPluginMeta(plugin)

    if (isPluginEssential(meta))
        throw new Error(`Plugin "${id}" is essential and cannot be stopped`)

    if (meta.status & Status.Stopping)
        throw new Error(`Plugin "${id}" is already stopping`)

    const { lifecycles } = plugin
    const { promises, handleError } = meta

    if (meta.status & (Status.PreIniting | Status.Initing | Status.Starting))
        await Promise.race([
            !isPluginErrored(plugin) && Promise.all(promises),
            sleepReject(
                MaxStopWaitTime,
                'Plugin lifecycles timed out, force stopping',
            ),
        ]).catch(e => {
            meta.flags |= PluginFlags.PendingReload
            return handleError(e)
        })
    else if (
        !(meta.status & (Status.PreInited | Status.Inited | Status.Started))
    )
        throw new Error(`Plugin "${id}" is not running`)

    await Promise.all(
        getPluginDependents(plugin, true).map(
            dep => !isPluginStopped(dep) && stopPlugin(dep),
        ),
    )

    meta.status |= Status.Stopping

    try {
        if (lifecycles.stop)
            await Promise.race([
                lifecycles.stop.apply(plugin, [plugin.api as PluginApi]),
                sleepReject(
                    MaxStopWaitTime,
                    'Plugin stop lifecycle timed out, force stopping',
                ),
            ])
    } catch (e) {
        await handleError(e)
    } finally {
        await cleanupPlugin(meta)

        plugin.api = undefined
        meta.apiLevel = PluginApiLevel.None
        meta.promises.length = 0
        meta.cleanups.length = 0
        meta.status = 0
    }
}

async function cleanupPlugin(meta: InternalPluginMeta) {
    async function handleStopError(e: unknown) {
        meta.flags |= PluginFlags.PendingReload
        return meta.handleError(e)
    }

    const proms: Promise<any>[] = []

    for (const cleanup of meta.cleanups)
        try {
            proms.push(cleanup())
        } catch (e) {
            await handleStopError(e)
        }

    await Promise.all(proms)
}
