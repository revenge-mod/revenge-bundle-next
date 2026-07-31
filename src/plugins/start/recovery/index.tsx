import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { onFluxEventDispatched } from '@revenge-mod/discord/flux'
import { RootNavigationRef } from '@revenge-mod/discord/modules/main_tabs_v2'
import { callNativeMethod } from '@revenge-mod/modules/native'
import {
    InternalPluginFlags,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import { isDefaultsOnlyBoot } from '@revenge-mod/plugins/constants'
import { asap } from '@revenge-mod/utils/callback'
import { FullVersion } from '~constants'
import { RouteNames } from '../settings.plugins/constants'

registerInternalPlugin(
    {
        id: 'revenge.recovery',
        name: 'Recovery',
        description: 'Provides troubleshooting options.',
        author: 'Revenge',
        icon: 'WrenchIcon',
    },
    {
        start() {
            // Freeze detection
            const id = setTimeout(() => {
                try {
                    callNativeMethod('revenge.alertError', [
                        'Application seems frozen. This is likely caused by a plugin.\n\nYou can launch with default plugins in the Recovery menu.',
                        FullVersion,
                    ])
                } catch (e) {
                    console.error(
                        'Failed to call native method "revenge.alertError":',
                        e,
                    )
                }
            }, 10000)

            const unsub = onFluxEventDispatched('APP_STATE_UPDATE', e => {
                clearTimeout(id)
                unsub()
                return e
            })

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

function RecoveryModal() {
    const navigation = RootNavigationRef.getRootNavigationRef()

    return (
        <Design.AlertModal
            title="Recovery Mode"
            content={
                'Running with default plugins. Your enabled plugins are saved and will come back when you reload.\n\nUninstall plugins that might be causing issues, then reload the app to get back on track.'
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
