import { sRefresher, sSections } from '@revenge-mod/discord/_/modules/settings'
import { onSettingsModulesLoaded } from '@revenge-mod/discord/modules/settings'
import {
    waitForModules,
    waitForModuleWithImportedPath,
} from '@revenge-mod/modules/finders'
import { withName } from '@revenge-mod/modules/finders/filters'
import { instead } from '@revenge-mod/patcher'
import { InternalPluginFlags, registerPlugin } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import { React } from '@revenge-mod/react'
import { asap, noop } from '@revenge-mod/utils/callback'
import { getCurrentStack } from '@revenge-mod/utils/error'
import { useReRender } from '@revenge-mod/utils/react'
import { useEffect } from 'react'
import type { FC } from 'react'

let DEBUG_patchedNavigator = false

const pluginSettings = registerPlugin(
    {
        id: 'revenge.settings',
        name: 'Settings',
        description: 'Settings UI for Revenge.',
        author: 'Revenge',
        icon: 'SettingsIcon',
    },
    {
        start() {
            // @as-require
            import('./plugins')

            onSettingsModulesLoaded(() => {
                // @as-require
                import('./register')

                // Debug warnings
                asap(() => {
                    if (__DEV__ && !DEBUG_patchedNavigator)
                        DEBUG_warnUnpatchedNavigator()
                })
            })

            waitForModuleWithImportedPath(
                'modules/user_settings/native/core/SettingsNavigator.tsx',
                exports => {
                    patchSettingsNavigator(exports)
                },
            )

            const unsubSOS = waitForModules(
                withName('SettingsOverviewScreen'),
                exports => {
                    unsubSOS()
                    patchSettingsOverviewScreen(exports)
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

function patchSettingsNavigator(exports: any) {
    instead(exports.default, 'type', (args, orig) => {
        const reRender = useReRender()
        useEffect(() => {
            sRefresher.callNavigator = reRender

            return () => {
                sRefresher.navigator = false
                sRefresher.callNavigator = noop
            }
        }, [reRender])

        // useMemo(() => getSettingScreens(), [])
        const unpatchMemo = instead(React, 'useMemo', (args, orig) => {
            if (!args[1]?.length && sRefresher.navigator) {
                args[1] = undefined
                sRefresher.navigator = false
            }

            return Reflect.apply(orig, React, args)
        })

        const el = Reflect.apply(orig, undefined, args)
        unpatchMemo()
        return el
    })

    DEBUG_patchedNavigator = true
}

let sectionsInst: object | undefined

function patchSettingsOverviewScreen(exports: any) {
    instead(
        exports as {
            default: FC
        },
        'default',
        (args, orig) => {
            const reRender = useReRender()
            useEffect(() => {
                sRefresher.callOverviewScreen = reRender

                return () => {
                    sRefresher.overviewScreen = false
                    sRefresher.callOverviewScreen = noop
                }
            }, [reRender])

            /**
             * In useOverviewSettings (called by SettingsOverviewScreen):
             *
             * const hasPremiumSubscriptionToDisplay = useHasPremiumSubscriptionToDisplay()
             * const sections = useMemo(() =>
             *   (...constructed sections array...),
             * [hasPremiumSubscriptionToDisplay])
             */
            const unpatchMemo = instead(React, 'useMemo', (args, orig) => {
                if (sRefresher.overviewScreen) args[1] = undefined

                const node = Reflect.apply(orig, React, args)
                const sections = node.sections

                // Add our custom sections here, and only do this per instance!
                if (sectionsInst !== sections) {
                    for (const section of Object.values(sSections))
                        if (section.index)
                            sections.splice(section.index, 0, section)
                        else sections.unshift(section)

                    sectionsInst = sections
                }

                if (sRefresher.overviewScreen) {
                    node.sections = sectionsInst = [...sections]
                    sRefresher.overviewScreen = false
                }

                return node
            })

            const el = Reflect.apply(orig, undefined, args)
            unpatchMemo()
            return el
        },
    )
}

export default pluginSettings

/**
 * Warns the developer that SettingsNavigator was not patched.
 */
function DEBUG_warnUnpatchedNavigator() {
    nativeLoggingHook(
        `\u001b[31mSettingsNavigator was not patched\n${getCurrentStack()}\u001b[0m`,
        2,
    )
}
