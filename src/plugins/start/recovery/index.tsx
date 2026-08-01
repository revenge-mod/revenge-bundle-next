import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { onFluxEventDispatched, Stores } from '@revenge-mod/discord/flux'
import { RootNavigationRef } from '@revenge-mod/discord/modules/main_tabs_v2'
import {
    onSettingsModulesLoaded,
    registerSettingsItem,
} from '@revenge-mod/discord/modules/settings'
import { callNativeMethod } from '@revenge-mod/modules/native'
import {
    InternalPluginFlags,
    isDefaultsOnlyBoot,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import { asap } from '@revenge-mod/utils/callback'
import { AppState } from 'react-native'
import { FullVersion } from '~constants'
import { mErrorChain } from '../../../../lib/modules/src/metro/runtime'
import pluginSettings from '../settings'
import { Setting } from '../settings/constants'
import { RouteNames } from '../settings.plugins/constants'
import RevengeEnterRecoveryModeSetting from './definitions/RevengeEnterRecoveryModeSetting'

registerInternalPlugin(
    {
        id: 'revenge.recovery',
        name: 'Recovery',
        description: 'Provides troubleshooting options.',
        author: 'Revenge',
        icon: 'ShieldIcon',
        dependencies: { [pluginSettings]: {} },
    },
    {
        start() {
            onSettingsModulesLoaded(() => {
                registerSettingsItem(
                    Setting.RevengeEnterRecoveryMode,
                    RevengeEnterRecoveryModeSetting,
                )
            })

            freezeDetectionService()

            if (isDefaultsOnlyBoot) {
                asap(() => {
                    AlertActionCreators.openAlert(
                        'revenge-recovery',
                        <RecoveryModal />,
                    )
                })
            }
        },
    },
    PluginFlags.Enabled,
    InternalPluginFlags.Internal | InternalPluginFlags.Essential,
)

function freezeDetectionService() {
    if ('AppStateStore' in Stores)
        // Stores already initialized, app is probably working fine
        return console.log(
            'AppStateStore already initialized, skipping freeze detection service...',
        )

    let currentId: number

    const setTimer = () => {
        if (currentId) clearTimeout(currentId)

        currentId = setTimeout(() => {
            if (AppState.currentState !== 'active') return

            try {
                callNativeMethod('revenge.alertError', [
                    `App was unable to start. This is likely caused by a plugin.\n\nYou can launch Recovery Mode in the Recovery menu.\n\nErroring modules chain: ${mErrorChain.join(', ') || 'None'}`,
                    FullVersion,
                ])
            } catch (e) {
                console.error(
                    'Failed to call native method "revenge.alertError":',
                    e,
                )
            }
        }, 5000)
    }

    const sub = AppState.addEventListener('change', state => {
        if (state === 'active') setTimer()
        else if (currentId !== undefined) clearTimeout(currentId)
    })

    if (AppState.currentState === 'active') setTimer()

    const clear = <T,>(e?: T) => {
        if (currentId !== undefined) clearTimeout(currentId)
        sub.remove()
        unsub()
        return e
    }

    const unsub = onFluxEventDispatched('APP_STATE_UPDATE', clear)
}

function RecoveryModal() {
    const navigation = RootNavigationRef.getRootNavigationRef()

    return (
        <Design.AlertModal
            title="Recovery Mode"
            content={
                "You are now running with default plugins. Additional plugins can't be started in Recovery Mode.\n\nDisable or uninstall plugins that might be causing issues, then reload the app to exit Recovery Mode."
            }
            actions={
                <>
                    <Design.AlertActionButton
                        variant="primary"
                        text="View plugins"
                        onPress={() => {
                            // React Navigation will bubble our requests to the main navigator if we're already in settings
                            navigation.navigate('settings', {
                                screen: RouteNames.RevengePlugins,
                            })
                        }}
                    />
                    <Design.AlertActionButton
                        variant="secondary"
                        text="Got it"
                    />
                </>
            }
        />
    )
}
