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
import { useEffect } from 'react'
import type { FC } from 'react'

import './register-routes'
import { React } from '@revenge-mod/react'
import { noop } from '@revenge-mod/utils/callback'
import { useReRender } from '@revenge-mod/utils/react'

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
            onSettingsModulesLoaded(() => {
                require('./register')
            })

            waitForModuleWithImportedPath(
                'modules/main_tabs_v2/native/settings/SettingsNavigator.tsx',
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

        const fiber = Reflect.apply(orig, undefined, args)
        unpatchMemo()
        return fiber
    })
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

                let sections = Reflect.apply(orig, React, args)

                // Add our custom sections here, and only do this per instance!
                if (sectionsInst !== sections) {
                    for (const section of Object.values(sSections))
                        if (section.index)
                            sections.splice(section.index, 0, section)
                        else sections.unshift(section)

                    sectionsInst = sections
                }

                if (sRefresher.overviewScreen) {
                    sections = sectionsInst = [...sections]
                    sRefresher.overviewScreen = false
                }

                return sections
            })

            const fiber = Reflect.apply(orig, undefined, args)
            unpatchMemo()
            return fiber
        },
    )
}

export default pluginSettings
