import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { onFluxEventDispatched, Stores } from '@revenge-mod/discord/flux'
import { RootNavigationRef } from '@revenge-mod/discord/modules/main_tabs_v2'
import {
    onSettingsModulesLoaded,
    registerSettingsItem,
} from '@revenge-mod/discord/modules/settings'
import { waitForModules } from '@revenge-mod/modules/finders'
import { withName } from '@revenge-mod/modules/finders/filters'
import { callNativeMethod, getBridgeInfo } from '@revenge-mod/modules/native'
import { instead } from '@revenge-mod/patcher'
import {
    InternalPluginFlags,
    isDefaultsOnlyBoot,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import { asap } from '@revenge-mod/utils/callback'
import { AppState } from 'react-native'
import { FullVersion } from '~constants'
import { cache as assetsCache } from '../../../../lib/assets/src/caches'
import { cache as modulesCache } from '../../../../lib/modules/src/caches'
import { mErrorChain } from '../../../../lib/modules/src/metro/runtime'
import pluginSettings from '../settings'
import { Setting } from '../settings/constants'
import { RouteNames } from '../settings.plugins/constants'
import ErrorBoundaryScreen from './components/ErrorBoundaryScreen'
import RevengeEnterRecoveryModeSetting from './definitions/RevengeEnterRecoveryModeSetting'
import type { Component, ReactNode } from 'react'

registerInternalPlugin(
    {
        id: 'revenge.recovery',
        name: 'Recovery',
        description:
            'Handles errors and provides troubleshooting options for Revenge.',
        author: 'Revenge',
        icon: 'ShieldIcon',
        dependencies: { [pluginSettings]: {} },
    },
    {
        start({ cleanup }) {
            onSettingsModulesLoaded(() => {
                registerSettingsItem(
                    Setting.RevengeEnterRecoveryMode,
                    RevengeEnterRecoveryModeSetting,
                )
            })

            cleanup(errorBoundaryService())

            freezeDetectionService()

            if (isDefaultsOnlyBoot) {
                asap(() => {
                    AlertActionCreators.openAlert(
                        'revenge-recovery',
                        <RecoveryModal />,
                    )
                })
            }

            if (assetsCache.outdated || modulesCache.outdated) {
                asap(() => {
                    AlertActionCreators.openAlert(
                        'revenge-loader-outdated',
                        <LoaderOutdatedModal />,
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

function errorBoundaryService() {
    const unsub = waitForModules(
        withName<typeof DiscordErrorBoundary>('ErrorBoundary'),
        exports => {
            unsub()

            instead(
                exports.prototype,
                'render',
                function (this: DiscordErrorBoundary) {
                    if (this.state.error)
                        return (
                            <ErrorBoundaryScreen
                                error={this.state.error}
                                reload={this.handleReload.bind(this)}
                                rerender={() => {
                                    this.setState({
                                        error: null,
                                        info: null,
                                    })
                                }}
                            />
                        )

                    return this.props.children
                },
            )
        },
        {
            cached: true,
        },
    )

    return unsub
}

declare class DiscordErrorBoundary extends Component<
    { children: ReactNode },
    {
        error: (Error & { componentStack?: string }) | unknown | null
        info: { componentStack?: string } | null
    }
> {
    // render() is always called with `this` as the instance of DiscordErrorBoundary
    render(this: DiscordErrorBoundary): ReactNode
    discordErrorsSet: boolean
    handleReload(): void
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

function LoaderOutdatedModal() {
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
