import { sRefresher, sSections } from '@revenge-mod/discord/_/modules/settings'
import { onSettingsModulesLoaded } from '@revenge-mod/discord/modules/settings'
import defer * as Renderer from '@revenge-mod/discord/modules/settings/renderer'
import { waitForModuleWithImportedPath } from '@revenge-mod/discord/utils/modules/finders'
import { lookupModule, waitForModules } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
    withSingleProp,
} from '@revenge-mod/modules/finders/filters'
import { instead } from '@revenge-mod/patcher'
import {
    InternalPluginFlags,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import { React, ReactModuleId } from '@revenge-mod/react'
import { asap, noop } from '@revenge-mod/utils/callback'
import { getCurrentStack } from '@revenge-mod/utils/error'
import { useReRender } from '@revenge-mod/utils/react'
import { cloneElement, useEffect } from 'react'
import type { SettingsSection } from '@revenge-mod/discord/modules/settings'
import type { AnyFunction, KeyWithType } from '@revenge-mod/utils/types'
import type {
    FC,
    MemoExoticComponent,
    ReactElement,
    ReactNode,
    useMemo,
} from 'react'

interface MemoComponentModule {
    default: MemoExoticComponent<FC<any>>
}

interface UseSettingSearchResultsModule {
    useSettingSearchResults: AnyFunction
}

interface SettingsOverviewScreenModule {
    default: FC
}

interface OverviewSettingsNode {
    sections?: SettingsSection[]
}

type UseMemoHook = (args: any[], useMemo_: typeof useMemo) => any

/** react/compiler-runtime, which React Compiler output memoizes with, instead of useMemo. */
interface ReactCompilerRuntime {
    c(size: number): unknown[]
}

type UseMemoCacheHook = (
    args: [size: number],
    c: ReactCompilerRuntime['c'],
) => unknown[]

type RefreshIdKey = KeyWithType<typeof sRefresher, number>
type RefreshCallbackKey = KeyWithType<typeof sRefresher, () => void>

let DEBUG_patchedNavigator = false

/** @see {remountHookHarness} */
let SettingHookHarness: MemoComponentModule['default'] | undefined

const pluginSettings = registerInternalPlugin(
    {
        id: 'revenge.settings',
        name: 'Settings',
        description: 'Settings UI for Revenge.',
        author: 'Revenge',
        icon: 'SettingsIcon',
    },
    {
        start() {
            onSettingsModulesLoaded(() => {
                // @as-require
                import('./register')

                patchSearchableSettingsList()

                asap(DEBUG_warnUnpatchedModules)
            })

            waitForModuleWithImportedPath<MemoComponentModule>(
                'modules/settings/native/renderer/SettingHookHarness.tsx',
                exports => {
                    SettingHookHarness = exports.default
                },
            )

            waitForModuleWithImportedPath<MemoComponentModule>(
                'modules/user_settings/core/native/SettingsNavigator.tsx',
                patchSettingsNavigator,
            )

            waitForModuleWithImportedPath(
                'modules/user_settings/overview/native/SettingsOverviewScreen.tsx',
                patchSettingsOverviewScreen,
            )

            const unsubUSSR = waitForModules(
                withProps('useSettingSearchResults'),
                exports => {
                    unsubUSSR()
                    patchUseSettingSearchResults(
                        exports as UseSettingSearchResultsModule,
                    )
                },
                {
                    cached: true,
                    returnNamespace: true,
                },
            )
        },
    },
    PluginFlags.Enabled,
    InternalPluginFlags.Internal | InternalPluginFlags.Essential,
)

export default pluginSettings

// #region Patches

function patchSettingsNavigator(exports: MemoComponentModule) {
    const shouldRefresh = createRefreshTracker('navigator')

    // useMemo(() => getSettingScreens(), [])
    instead(exports.default, 'type', (args, orig) => {
        useRefresherCallback('callNavigator')

        const refresh = shouldRefresh()
        const el = applyWithMemoRefresh(orig, args, refresh)

        return refresh ? remountHookHarness(el) : el
    })

    DEBUG_patchedNavigator = true
}

function remountHookHarness(el: ReactElement<{ children?: ReactNode[] }>) {
    const children = el.props.children

    if (Array.isArray(children)) {
        const index = children.findIndex(
            child =>
                (child as ReactElement | undefined)?.type ===
                SettingHookHarness,
        )

        if (index !== -1) {
            const newChildren = [...children]
            newChildren[index] = cloneElement(children[index] as ReactElement, {
                key: `revenge.${sRefresher.navigator}`,
            })

            return cloneElement(el, { children: newChildren })
        }
    }

    DEBUG_warn('SettingHookHarness was not rendered')

    return el
}

function patchSettingsOverviewScreen(exports: SettingsOverviewScreenModule) {
    const shouldRefresh = createRefreshTracker('overviewScreen')

    // The node our sections were last added to, and the node with them added.
    let lastNode: OverviewSettingsNode | undefined
    let patchedNode: OverviewSettingsNode | undefined

    instead(exports, 'default', (args, orig) => {
        useRefresherCallback('callOverviewScreen')

        /**
         * SettingsOverviewScreen renders <SettingsOverviewScreen node={node} />, where node is getOverviewSettings():
         *
         * const hasPremiumSubscriptionToDisplay = useHasPremiumSubscriptionToDisplay()
         * const node = useMemo(() =>
         *   (...constructed sections array...),
         * [hasPremiumSubscriptionToDisplay])
         */
        const el = Reflect.apply(orig, undefined, args) as ReactElement<
            Record<string, unknown>
        > | null

        const entry = el && findOverviewSettingsNode(el.props)
        if (!entry) {
            DEBUG_warnOnce('SettingsOverviewScreen did not render sections')
            return el
        }

        const [prop, node] = entry

        // Our sections are added to a copy, so refreshing doesn't need Discord to recompute node.
        // The list only updates if node changes identity.
        if (shouldRefresh() || lastNode !== node) {
            const sections = [...node.sections]

            for (const section of Object.values(sSections))
                if (section.index) sections.splice(section.index, 0, section)
                else sections.unshift(section)

            lastNode = node
            patchedNode = { ...node, sections }
        }

        return cloneElement(el, { [prop]: patchedNode })
    })
}

function findOverviewSettingsNode(
    props: Record<string, unknown>,
): [prop: string, node: Required<OverviewSettingsNode>] | undefined {
    for (const prop in props) {
        const value = props[prop] as OverviewSettingsNode | null | undefined
        if (Array.isArray(value?.sections))
            return [prop, value as Required<OverviewSettingsNode>]
    }
}

function patchSearchableSettingsList() {
    const shouldRefresh = createRefreshTracker('navigator')

    // Renders (and memoizes) the results of useSettingSearchResults
    instead(
        Renderer.SettingListRenderer.SearchableSettingsList,
        'type',
        (args, orig) => {
            useRefresherCallback('callSearchableSettingsList')
            return applyWithMemoRefresh(orig, args, shouldRefresh())
        },
    )
}

function patchUseSettingSearchResults(exports: UseSettingSearchResultsModule) {
    const shouldRefresh = createRefreshTracker('navigator')

    // useMemo(() => getSettingSearchableTitles(), [])
    instead(exports, 'useSettingSearchResults', (args, orig) =>
        applyWithMemoRefresh(orig, args, shouldRefresh()),
    )
}

// #region Refreshing

/**
 * Creates a tracker for a refresh ID, telling whether a refresh has been
 * requested since it was last called.
 *
 * Every patch needs its own tracker, as they all render (and therefore consume
 * refreshes) independently from each other.
 *
 * @param key The refresh ID to track.
 */
function createRefreshTracker(key: RefreshIdKey) {
    let lastId = sRefresher[key]

    return () => {
        const id = sRefresher[key]
        if (id === lastId) return false

        lastId = id
        return true
    }
}

/**
 * Registers the component's re-render function as a refresher callback for as long as it is mounted.
 *
 * @param key The callback to register as.
 */
function useRefresherCallback(key: RefreshCallbackKey) {
    const reRender = useReRender()

    useEffect(() => {
        sRefresher[key] = reRender

        return () => {
            sRefresher[key] = noop
        }
    }, [key, reRender])
}

/** Recomputes a memo. */
const refreshMemo: UseMemoHook = (args, useMemo) => {
    // Pass no dependency array
    args[1] = undefined
    return Reflect.apply(useMemo, undefined, args)
}

/**
 * Compiled code checks slots against this exact symbol, so it can't change without breaking already compiled code.
 *
 * @see {@link https://github.com/react/react/blob/v19.2.3/packages/shared/ReactSymbols.js#L43}
 */
const MemoCacheSentinel = Symbol.for('react.memo_cache_sentinel')

/** Recomputes every memo in a React Compiler cache. */
const refreshMemoCache: UseMemoCacheHook = (args, c) => {
    // Compiled code recomputes every slot holding the sentinel, and writes the result back to the cache
    const cache = Reflect.apply(c, undefined, args)
    cache.fill(MemoCacheSentinel)
    return cache
}

let CompilerRuntime: ReactCompilerRuntime | null | undefined

function getReactCompilerRuntime() {
    if (CompilerRuntime === undefined) {
        const [module] = lookupModule(
            withSingleProp<ReactCompilerRuntime>('c').and(
                withDependencies([ReactModuleId]),
            ),
            { initialize: false },
        )

        CompilerRuntime = module ?? null
    }

    return CompilerRuntime
}

/**
 * Applies a component's render function (or a hook), refreshing the memos it creates if needed.
 *
 * @param fn The function to apply.
 * @param args The arguments to apply the function with.
 * @param refresh Whether the memos should be refreshed.
 */
function applyWithMemoRefresh(
    fn: AnyFunction,
    args: unknown[],
    refresh: boolean,
) {
    if (!refresh) return Reflect.apply(fn, undefined, args)

    const unpatchUseMemo = instead(React, 'useMemo', refreshMemo)

    // React Compiler output memoizes with c(size) instead of useMemo
    const runtime = getReactCompilerRuntime()
    const unpatchC = runtime ? instead(runtime, 'c', refreshMemoCache) : noop

    try {
        return Reflect.apply(fn, undefined, args)
    } finally {
        unpatchC()
        unpatchUseMemo()
    }
}

// #region Debug

/**
 * Warns the developer about settings modules that were never patched.
 */
function DEBUG_warnUnpatchedModules() {
    if (!DEBUG_patchedNavigator) DEBUG_warn('SettingsNavigator was not patched')
    if (!SettingHookHarness) DEBUG_warn('SettingHookHarness was not found')
}

const DEBUG_warned = new Set<string>()

function DEBUG_warnOnce(message: string) {
    if (__DEV__ && !DEBUG_warned.has(message)) {
        DEBUG_warned.add(message)
        DEBUG_warn(message)
    }
}

function DEBUG_warn(message: string) {
    if (__DEV__)
        nativeLoggingHook(
            `\u001b[31m${message}\n${getCurrentStack()}\u001b[0m`,
            2,
        )
}
