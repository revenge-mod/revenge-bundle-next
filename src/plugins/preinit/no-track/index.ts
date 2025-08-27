import { waitForModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { getModuleDependencies } from '@revenge-mod/modules/metro/utils'
import { instead } from '@revenge-mod/patcher'
import { InternalPluginFlags, registerPlugin } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import { noop } from '@revenge-mod/utils/callback'
import { getCurrentStack } from '@revenge-mod/utils/error'

const cachedOnly = {
    cached: true,
}

// TODO(plugins/no-track): Block Sentry native-side
registerPlugin(
    {
        id: 'revenge.no-track',
        name: 'No Track',
        description: 'Disables Discord and Sentry analytics.',
        author: 'Revenge',
        icon: 'AnalyticsIcon',
    },
    {
        preInit({ cleanup, plugin }) {
            if (plugin.flags & PluginFlags.EnabledLate)
                plugin.flags |= PluginFlags.ReloadRequired

            // utils/SentryUtils.native.tsx
            const unsubSU = waitForModules(
                withProps<{
                    profiledRootComponent<T>(x: T): T
                    addBreadcrumb(): void
                    setTags(): void
                    setUser(): void
                }>('profiledRootComponent'),
                SentryUtils => {
                    unsubSU()

                    // These functions by Discord attempt to call Sentry APIs that set __SENTRY__
                    instead(
                        SentryUtils,
                        'profiledRootComponent',
                        args => args[0],
                    )
                    instead(SentryUtils, 'addBreadcrumb', noop)
                    instead(SentryUtils, 'setTags', noop)
                    instead(SentryUtils, 'setUser', noop)
                },
                cachedOnly,
            )

            // modules/errors/native/SentryInitUtils.tsx
            const unsubSIU = waitForModules(
                withProps('initSentry'),
                SentryInitUtils => {
                    unsubSIU()

                    instead(SentryInitUtils, 'initSentry', noop)
                },
                cachedOnly,
            )

            // Discord uses ReactNavigationInstrumentation to track navigation
            // Discord also uses Profiler to track performance, but we blocked that by patching profiledRootComponent
            // Note that to actually find Sentry, we just need to add 'init' to withProps
            const unsubSentryInst = waitForModules(
                withProps('ReactNavigationInstrumentation'),
                exports => {
                    unsubSentryInst()

                    instead(
                        exports,
                        'ReactNavigationInstrumentation',
                        function () {
                            // https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-navigation/#initialization
                            this.registerNavigationContainer = noop
                        },
                    )
                },
                cachedOnly,
            )

            if (__DEV__)
                Object.defineProperty(globalThis, '__SENTRY__', {
                    set: () => {
                        warnSetSentry(getCurrentStack())
                    },
                })
            else
                Object.defineProperty(globalThis, '__SENTRY__', {
                    writable: false,
                })

            cleanup(unsubSU, unsubSIU, unsubSentryInst)
        },
        init({ cleanup }) {
            // utils/AnalyticsUtils.tsx
            const unsubAU = waitForModules(
                withProps<{
                    trackNetworkAction: () => void
                    default: {
                        track: () => void
                        AnalyticsActionHandlers: Record<string, () => void>
                    }
                }>('trackNetworkAction'),
                AnalyticsUtils => {
                    unsubAU()

                    instead(AnalyticsUtils.default, 'track', noop)
                    instead(AnalyticsUtils, 'trackNetworkAction', noop)

                    const { AnalyticsActionHandlers: handlers } =
                        AnalyticsUtils.default

                    for (const key of Object.keys(handlers))
                        instead(handlers, key, noop)
                },
                cachedOnly,
            )

            cleanup(unsubAU)
        },
        start({
            cleanup,
            logger,
            unscoped: {
                discord: {
                    common: {
                        flux: { DispatcherModuleId },
                    },
                },
            },
        }) {
            // modules/app_analytics/useTrackImpression.tsx
            const unsubTI = waitForModules(
                withProps<{
                    default: () => void
                    trackImpression: () => void
                }>('trackImpression'),
                useTrackImpression => {
                    unsubTI()

                    instead(useTrackImpression, 'trackImpression', noop)
                    instead(useTrackImpression, 'default', noop)
                },
                cachedOnly,
            )

            // actions/AnalyticsTrackActionCreators.tsx
            const unsubATAC = waitForModules(
                withProps('track'),
                (AnalyticsTrackActionCreators, id) => {
                    if (getModuleDependencies(id)![0] === DispatcherModuleId) {
                        unsubATAC()

                        logger.info('Patching AnalyticsTrackActionCreators...')
                        instead(AnalyticsTrackActionCreators, 'track', noop)
                    }
                },
                cachedOnly,
            )

            cleanup(unsubTI, unsubATAC)
        },
        stop({ plugin }) {
            plugin.flags |= PluginFlags.ReloadRequired
        },
    },
    PluginFlags.Enabled,
    InternalPluginFlags.Internal,
)

function warnSetSentry(stack: string) {
    nativeLoggingHook(
        `\u001b[33mNo Track: Attempt to set __SENTRY__\n${stack}\u001b[0m`,
        2,
    )
}
