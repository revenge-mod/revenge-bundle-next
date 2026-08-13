import defer * as Actions from '@revenge-mod/discord/actions'
import { onFluxEventDispatched } from '@revenge-mod/discord/flux'
import { waitForModules } from '@revenge-mod/modules/finders'
import { withName } from '@revenge-mod/modules/finders/filters'
import { callNativeMethod } from '@revenge-mod/modules/native'
import { instead } from '@revenge-mod/patcher'
import {
    InternalPluginFlags,
    isDefaultsOnlyBoot,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import { onRunApplicationFinished } from '@revenge-mod/react/native'
import { asap } from '@revenge-mod/utils/callback'
import { getErrorStack } from '@revenge-mod/utils/error'
import { AppState } from 'react-native'
import { FullVersion } from '~constants'
import { cache as assetsCache } from '../../../../lib/assets/src/caches'
import { cache as modulesCache } from '../../../../lib/modules/src/caches'
import { mErrorChain } from '../../../../lib/modules/src/metro/runtime'
import pluginSettings from '../../start/settings'
import defer * as Alerts from './components/alerts'
import defer * as ErrorBoundaryScreen from './components/ErrorBoundaryScreen'
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
        preInit({ cleanup }) {
            cleanup(freezeDetectionService())
        },
        start({ cleanup }) {
            // @as-require
            import('./settings')

            cleanup(errorBoundaryService())

            asap(() => {
                if (isDefaultsOnlyBoot) {
                    Actions.AlertActionCreators.openAlert(
                        'revenge-recovery',
                        <Alerts.RecoveryModal />,
                    )
                }

                if (assetsCache.outdated || modulesCache.outdated) {
                    Actions.AlertActionCreators.openAlert(
                        'revenge-loader-outdated',
                        <Alerts.LoaderOutdatedModal />,
                    )
                }
            })
        },
    },
    PluginFlags.Enabled,
    InternalPluginFlags.Internal | InternalPluginFlags.Essential,
)

const FreezeDetectionTimeout = 5000

function freezeDetectionService() {
    let currentId: number | undefined
    let cleared = false

    let sub: { remove(): void } | undefined
    let unsubFlux: (() => void) | undefined

    const setTimer = () => {
        onRunApplicationFinished(() => {
            if (cleared) return
            if (currentId !== undefined) clearTimeout(currentId)

            currentId = setTimeout(() => {
                currentId = undefined

                if (AppState.currentState !== 'active') return

                try {
                    let text =
                        'App was unable to start. This is likely caused by a plugin.\n\n' +
                        'You can launch Recovery Mode in the Recovery menu.'

                    if (mErrorChain.length > 0) {
                        text += `\n\nErroring modules chain: ${mErrorChain.map(([id]) => id).join(', ')}`
                        text += `\n\nStacks:\n\n${mErrorChain.map(([id, stack]) => `[${id}] ${getErrorStack(stack)}`).join('\n\n')}`
                    } else {
                        text += '\n\nNo erroring modules were detected.'
                    }

                    callNativeMethod('revenge.alertError', [text, FullVersion])
                } catch (e) {
                    console.error(
                        'Failed to call native method "revenge.alertError":',
                        e,
                    )
                }
            }, FreezeDetectionTimeout)
        })
    }

    const clear = <T,>(e?: T) => {
        cleared = true

        if (currentId !== undefined) {
            clearTimeout(currentId)
            currentId = undefined
        }

        sub?.remove()
        unsubFlux?.()

        return e
    }

    unsubFlux = onFluxEventDispatched('APP_STATE_UPDATE', clear)
    // clear() may have run before unsubStore/unsubFlux was assigned, so run it again to unsub
    if (cleared) {
        clear()
        return clear
    }

    sub = AppState.addEventListener('change', state => {
        if (state === 'active') setTimer()
        else if (currentId !== undefined) {
            clearTimeout(currentId)
            currentId = undefined
        }
    })

    if (AppState.currentState === 'active') setTimer()

    return clear
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
                            <ErrorBoundaryScreen.default
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
