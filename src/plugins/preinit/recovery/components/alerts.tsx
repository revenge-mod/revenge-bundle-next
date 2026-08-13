import { Design } from '@revenge-mod/discord/design'
import { RootNavigationRef } from '@revenge-mod/discord/modules/main_tabs_v2'
import { getBridgeInfo } from '@revenge-mod/modules/native'
import { RouteNames } from '~plugins/start/settings.plugins/constants'

export function RecoveryModal() {
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

export function LoaderOutdatedModal() {
    const info = getBridgeInfo()
    if (!info) throw new Error('Failed to get native bridge info')

    return (
        <Design.AlertModal
            title="Loader Outdated"
            content={`Your loader is outdated. Update to the latest version to receive fixes and ensure compatibility with all plugins.\n\nYou're currently running ${info.name} v${info.version}`}
            actions={
                <Design.AlertActionButton variant="primary" text="Got it" />
            }
        />
    )
}
