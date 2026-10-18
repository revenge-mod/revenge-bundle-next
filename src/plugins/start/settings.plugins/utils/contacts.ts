import { ImportTrackerModuleId } from '@revenge-mod/discord/common/import-tracker'
import { LoggerModuleId } from '@revenge-mod/discord/common/logger'
import { withStoreName } from '@revenge-mod/discord/flux'
import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withName,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { Linking } from 'react-native'
import { showErrorToast } from './alerts'
import type { DiscordModules } from '@revenge-mod/discord/types'

const { ordered, relative } = withDependencies

type ShowUserProfileActionSheet = (
    props: { userId: string },
    stackingBehavior?: Parameters<
        DiscordModules.Actions.ActionSheetActionCreators['openLazy']
    >[3],
) => void

interface LinkHandler {
    handleClick(props: { href: string; onConfirm: () => void }): void
}

const getStoreModuleId = (name: string) => lookupModule(withStoreName(name))[1]

/** Opens the Discord profile sheet of a user. */
export function openUserProfile(userId: string) {
    const [showUserProfileActionSheet] = lookupModule(
        withName<ShowUserProfileActionSheet>('showUserProfileActionSheet').and(
            withDependencies(
                ordered([
                    LoggerModuleId,
                    getStoreModuleId('UserStore'),
                    relative(1),
                    relative(2),
                    relative(3),
                    ImportTrackerModuleId,
                ]),
            ),
        ),
    )

    if (showUserProfileActionSheet)
        showUserProfileActionSheet({ userId }, 'stack')
    else showErrorToast('Could not open user profile', 'OPEN_PROFILE_ERROR')
}

/** Opens a link through Discord's link handler, which confirms untrusted links. */
export function openLink(href: string) {
    const open = () => Linking.openURL(href)

    const [LinkHandler] = lookupModule(
        withProps<LinkHandler>('handleClick').and(
            withDependencies(
                ordered([
                    relative(1),
                    getStoreModuleId('ChannelStore'),
                    getStoreModuleId('GuildStore'),
                    relative(2),
                    getStoreModuleId('MessageStore'),
                    ImportTrackerModuleId,
                ]),
            ),
        ),
    )

    if (LinkHandler) LinkHandler.handleClick({ href, onConfirm: open })
    else open()
}
