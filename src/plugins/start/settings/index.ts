import { sRefresher, sSections } from '@revenge-mod/discord/_/modules/settings'
import { onSettingsModulesLoaded } from '@revenge-mod/discord/modules/settings'
import defer * as Renderer from '@revenge-mod/discord/modules/settings/renderer'
import { waitForModuleWithImportedPath } from '@revenge-mod/discord/utils/modules/finders'
import { waitForModules } from '@revenge-mod/modules/finders'
import { withName, withProps } from '@revenge-mod/modules/finders/filters'
import { instead } from '@revenge-mod/patcher'
import {
    InternalPluginFlags,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import { React } from '@revenge-mod/react'
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

            const unsubSOS = waitForModules(
                withName('SettingsOverviewScreen'),
                exports => {
                    unsubSOS()
                    patchSettingsOverviewScreen(
                        exports as SettingsOverviewScreenModule,
                    )
                },
                {
                    cached: true,
                    returnNamespace: true,
                },
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

    // The sections array our sections were last added to.
    let patchedSections: SettingsSection[] | undefined
    let refreshing = false

    /**
     * In useOverviewSettings (called by SettingsOverviewScreen):
     *
     * const hasPremiumSubscriptionToDisplay = useHasPremiumSubscriptionToDisplay()
     * const sections = useMemo(() =>
     *   (...constructed sections array...),
     * [hasPremiumSubscriptionToDisplay])
     */
    const useMemoHook: UseMemoHook = (args, useMemo) => {
        // Reconstruct the sections, so newly registered ones are included
        const node: OverviewSettingsNode | undefined = refreshing
            ? refreshMemo(args, useMemo)
            : Reflect.apply(useMemo, React, args)

        const sections = node?.sections
        if (!sections) return node

        // Add our custom sections here, and only do this per instance
        if (patchedSections !== sections) {
            for (const section of Object.values(sSections))
                if (section.index) sections.splice(section.index, 0, section)
                else sections.unshift(section)

            patchedSections = sections
        }

        // The screen only updates if the sections array changes identity
        if (refreshing) {
            node.sections = patchedSections = [...sections]
            refreshing = false
        }

        return node
    }

    instead(exports, 'default', (args, orig) => {
        useRefresherCallback('callOverviewScreen')

        refreshing = shouldRefresh()
        return applyWithUseMemoHook(useMemoHook, orig, args)
    })
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
    return Reflect.apply(useMemo, React, args)
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
    return refresh
        ? applyWithUseMemoHook(refreshMemo, fn, args)
        : Reflect.apply(fn, undefined, args)
}

function applyWithUseMemoHook(
    hook: UseMemoHook,
    fn: AnyFunction,
    args: unknown[],
) {
    const unpatch = instead(React, 'useMemo', hook)

    try {
        return Reflect.apply(fn, undefined, args)
    } finally {
        unpatch()
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

function DEBUG_warn(message: string) {
    if (__DEV__)
        nativeLoggingHook(
            `\u001b[31m${message}\n${getCurrentStack()}\u001b[0m`,
            2,
        )
}
