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

const { ordered, relative } = withDependencies

type ShowUserProfileActionSheet = (props: { userId: string }) => void

interface LinkHandler {
    handleClick(props: { href: string; onConfirm: () => void }): void
}

let showUserProfileActionSheet: ShowUserProfileActionSheet | undefined
let LinkHandler: LinkHandler | undefined

const getStoreModuleId = (name: string) => lookupModule(withStoreName(name))[1]

/** Opens the Discord profile sheet of a user. */
export function openUserProfile(userId: string) {
    showUserProfileActionSheet ??= lookupModule(
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
    )[0]

    if (showUserProfileActionSheet) showUserProfileActionSheet({ userId })
    else showErrorToast('Could not open user profile')
}

/** Opens a link through Discord's link handler, which confirms untrusted links. */
export function openLink(href: string) {
    const open = () => Linking.openURL(href)

    LinkHandler ??= lookupModule(
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
    )[0]

    if (LinkHandler) LinkHandler.handleClick({ href, onConfirm: open })
    else open()
}
