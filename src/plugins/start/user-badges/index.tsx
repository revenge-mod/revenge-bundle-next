import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { getModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { InternalPluginFlags, registerPlugin } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import { afterJSX, beforeJSX } from '@revenge-mod/react/jsx-runtime'
import { findInReactFiber } from '@revenge-mod/utils/react'
import { Image } from 'react-native'
import { Badges, UsersWithBadges } from './constants'
import { styles, useBadgeStyles } from './styles'
import { afterReconciled } from './utils'
import type { FC, ReactElement } from 'react'
import type {
    ImageProps,
    ImageSourcePropType,
    ImageStyle,
    PressableProps,
    StyleProp,
} from 'react-native'
import type { Badge, BadgeId } from './constants'

const DUMMY_SYMBOL = {} as unknown as string

interface ProfileBadgeProps {
    id: string
    userId: string
    label: string
    source: ImageSourcePropType
    themeType: string
    badgeSize: number
}

interface ProfileBadgeRowsProps {
    userId: string
    badges: Array<{
        description: string
        icon: string
        id: string
        link?: string
    }>
    themeType: string
    showToastOnPress?: boolean
}

type ViewWithProfileBadges = ReactElement<{
    children: Array<ReactElement<ProfileBadgeProps, FC<ProfileBadgeProps>>>
}>

registerPlugin(
    {
        id: 'revenge.user-badges',
        name: 'User Badges',
        description: 'Badges for Revenge contributors and sponsors.',
        author: 'Revenge',
        icon: 'ShieldUserIcon',
    },
    {
        start({ cleanup }) {
            const unsub = getModules(
                withProps<{ ProfileBadgeRows: FC<ProfileBadgeRowsProps> }>(
                    'ProfileBadgeRows',
                ),
                ({ ProfileBadgeRows }) => {
                    cleanup(
                        beforeJSX(ProfileBadgeRows, args => {
                            const [, props] = args

                            // Inject dummy badge for users with custom badges to ensure ProfileBadge components exist
                            if (
                                // has custom badges
                                UsersWithBadges[props.userId] &&
                                // but no actual badges
                                !props.badges.length
                            )
                                // @ts-expect-error: This will never be rendered
                                props.badges.push({ id: DUMMY_SYMBOL })

                            return args
                        }),
                    )

                    cleanup(
                        afterJSX(ProfileBadgeRows, fiber => {
                            patchProfileBadgeRows(fiber)
                            return fiber
                        }),
                    )
                },
            )

            cleanup(unsub)
        },
        stop({ plugin }) {
            plugin.flags |= PluginFlags.ReloadRequired
        },
    },
    PluginFlags.Enabled,
    // Essential because this is a perk
    InternalPluginFlags.Internal | InternalPluginFlags.Essential,
)

function patchProfileBadgeRows(
    element: ReactElement<ProfileBadgeRowsProps, FC<ProfileBadgeRowsProps>>,
): void {
    const unpatch = afterReconciled(element, fiber => {
        unpatch()

        const container = findInReactFiber(
            fiber as ReactElement,
            isViewContainingProfileBadgeElements,
        )

        if (!container) return fiber

        const [{ type: ProfileBadge, props }] = container.props.children
        const userBadges = UsersWithBadges[props.userId]

        if (userBadges) {
            for (const badgeId of userBadges) {
                const badge = Badges[badgeId]
                if (!badge) continue

                const badgeElement = (
                    <ProfileBadge
                        {...props}
                        key={badgeId}
                        id={badgeId}
                        label={badge.label}
                        source={badge.icon}
                    />
                )

                patchProfileBadge(badgeElement, badgeId, badge)
                container.props.children.push(badgeElement)
            }

            // Remove dummy badge if it exists
            if (props.id === DUMMY_SYMBOL) container.props.children.pop()
        }

        return fiber
    })
}

function patchProfileBadge(
    element: ReactElement<ProfileBadgeProps, FC<ProfileBadgeProps>>,
    id: BadgeId,
    badge: Badge,
): void {
    const { bnw, showDialog } = badge
    // Return early if we don't actually need to patch this badge
    if (!bnw && !showDialog) return

    const unpatch = afterReconciled(element, fiber => {
        unpatch()

        // This will not result in a conditional hook error because badges do not change flags during runtime
        const badgeStyles = useBadgeStyles()

        if (showDialog) {
            const pressable = findInReactFiber(
                fiber as ReactElement,
                (node): node is ReactElement<PressableProps> =>
                    node.type?.render,
            )

            if (pressable)
                pressable.props.onPress = () =>
                    openBadgeDialog(id, badge, badgeStyles)
        }

        if (bnw) {
            const image = findInReactFiber(
                fiber as ReactElement,
                (node): node is ReactElement<ImageProps> => node.type === Image,
            )

            if (image) {
                const styles = image.props.style as Extract<
                    StyleProp<ImageStyle>,
                    any[]
                >
                styles.push(badgeStyles.tinted)
            }
        }

        return fiber
    })
}

const { AlertActionButton, AlertModal, Stack, Text } = Design

function openBadgeDialog(
    id: BadgeId,
    { label, description, bnw, icon }: Badge,
    badgeStyles: ReturnType<typeof useBadgeStyles>,
): void {
    AlertActionCreators.openAlert(
        `REVENGE_PROFILE_BADGE-${id}`,
        <AlertModal
            title={
                <Stack style={styles.stack}>
                    <Image
                        source={icon}
                        style={[styles.display, bnw && badgeStyles.tinted]}
                    />
                    <Text variant="heading-lg/bold" color="header-primary">
                        {label}
                    </Text>
                </Stack>
            }
            content={description}
            actions={<AlertActionButton text="Okay" />}
        />,
    )
}

const isViewContainingProfileBadgeElements = (
    node: any,
): node is ViewWithProfileBadges =>
    node.props?.children?.[0]?.type.name === 'ProfileBadge'
