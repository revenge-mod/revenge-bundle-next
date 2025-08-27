import { waitForModules } from '@revenge-mod/modules/finders'
import { withName } from '@revenge-mod/modules/finders/filters'
import { instead } from '@revenge-mod/patcher'
import { InternalPluginFlags, registerPlugin } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import ErrorBoundaryScreen from './components/ErrorBoundaryScreen'
import type { Component, ReactNode } from 'react'

registerPlugin(
    {
        id: 'revenge.error-boundary',
        name: 'Error Boundary',
        description: 'Shows debug information on rendering crashes.',
        author: 'Revenge',
        icon: 'ScreenXIcon',
    },
    {
        start({ cleanup }) {
            const unsubEB = waitForModules(
                withName<typeof DiscordErrorBoundary>('ErrorBoundary'),
                exports => {
                    unsubEB()

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

            cleanup(unsubEB)
        },
    },
    PluginFlags.Enabled,
    InternalPluginFlags.Internal | InternalPluginFlags.Essential,
)

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
