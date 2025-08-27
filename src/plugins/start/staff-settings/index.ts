import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { getStore, Stores } from '@revenge-mod/discord/flux'
import { getModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { instead } from '@revenge-mod/patcher'
import { InternalPluginFlags, registerPlugin } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import type { DiscordModules } from '@revenge-mod/discord/types'

registerPlugin(
    {
        id: 'revenge.staff-settings',
        name: 'Staff Settings',
        description: "Allows accessing Discord's Staff Settings.",
        author: 'Revenge',
        icon: 'StaffBadgeIcon',
    },
    {
        start({ cleanup, logger }) {
            const CircleInformationIcon = lookupGeneratedIconComponent(
                'CircleInformationIcon',
                'CircleInformationIcon-secondary',
                'CircleInformationIcon-primary',
            )

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

                    ToastActionCreators.open({
                        key: 'staff-settings-action',
                        content: 'Navigate out of Settings to apply changes',
                        IconComponent: CircleInformationIcon,
                    })
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
                    )

                    reset()
                }),
            )
        },
    },
    PluginFlags.Enabled,
    InternalPluginFlags.Internal,
)
