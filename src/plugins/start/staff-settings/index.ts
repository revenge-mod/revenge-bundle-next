import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { getStore, Stores } from '@revenge-mod/discord/flux'
import { getModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { instead } from '@revenge-mod/patcher'
import {
    InternalPluginFlags,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import type { DiscordModules } from '@revenge-mod/discord/types'

registerInternalPlugin(
    {
        id: 'revenge.staff-settings',
        name: 'Staff Settings',
        description: "Allows accessing Discord's Staff Settings.",
        author: 'Revenge',
        icon: 'StaffBadgeIcon',
    },
    {
        start({ cleanup, logger, plugin }) {
            const CircleInformationIcon = lookupGeneratedIconComponent(
                'CircleInformationIcon',
                'CircleInformationIcon-secondary',
                'CircleInformationIcon-primary',
            )

            const showToast = () =>
                ToastActionCreators.open({
                    key: 'staff-settings-action',
                    content: 'Navigate out of Settings to apply changes',
                    IconComponent: CircleInformationIcon,
                })

            function reset() {
                getStore<{
                    initialize(): void
                }>('DeveloperExperimentStore', store => {
                    logger.log(
                        'Reinitializing DeveloperExperimentStore to apply changes...',
                    )

                    const unpatch = instead(
                        Object,
                        'defineProperties',
                        args => args[0],
                    )

                    store.initialize()
                    unpatch()
                })
            }

            cleanup(
                getModules(withProps('isStaffEnv'), UserStoreUtils => {
                    logger.log('Patching UserStoreUtils...')

                    cleanup(
                        instead(
                            UserStoreUtils,
                            'isStaffEnv',
                            ([user]) =>
                                user ===
                                (
                                    Stores.UserStore as DiscordModules.Flux.Store<{
                                        getCurrentUser(): unknown
                                    }>
                                ).getCurrentUser(),
                        ),
                        reset,
                        showToast,
                    )

                    reset()
                    if (plugin.startedLate) showToast()
                }),
            )
        },
    },
    PluginFlags.Enabled,
    InternalPluginFlags.Internal,
)
