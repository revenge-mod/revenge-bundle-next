import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { getModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import {
    InternalPluginFlags,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import { insteadJSX } from '@revenge-mod/react/jsx-runtime'
import { createElement, isValidElement } from 'react'
import { Image } from 'react-native'
import { Badges, UsersWithBadges } from './constants'
import { styles, useBadgeStyles } from './styles'
import { mapElementTree, patchRender } from './utils'
import type { FC, ReactElement, ReactNode } from 'react'
import type { ImageSourcePropType } from 'react-native'
import type { Badge, BadgeId } from './constants'
import type { RenderPatch } from './utils'

type BadgeStyles = ReturnType<typeof useBadgeStyles>

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

const DummyBadgeId = {} as unknown as string
const DummyBadges = [
    { id: DummyBadgeId },
] as unknown as ProfileBadgeRowsProps['badges']

registerInternalPlugin(
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
                        insteadJSX(
                            ProfileBadgeRows,
                            ([type, props, key], jsx) => {
                                if (
                                    !UsersWithBadges[props.userId] ||
                                    typeof type !== 'function'
                                )
                                    return jsx(type, props, key)

                                // Inject dummy badge for users with custom badges to ensure ProfileBadge components exist
                                return jsx(
                                    patchRender(type, injectCustomBadges),
                                    props.badges.length
                                        ? props
                                        : { ...props, badges: DummyBadges },
                                    key,
                                )
                            },
                        ),
                    )
                },
            )

            cleanup(unsub)
        },
        stop({ plugin }) {
            plugin.requireReload()
        },
    },
    PluginFlags.Enabled,
    // Essential because this is a perk
    InternalPluginFlags.Internal | InternalPluginFlags.Essential,
)

/** Matched structurally, as minified builds don't preserve `type.name`. */
function isProfileBadgeElement(
    node: ReactNode,
): node is ReactElement<ProfileBadgeProps, FC<ProfileBadgeProps>> {
    if (!isValidElement(node) || typeof node.type !== 'function') return false

    const props = node.props as Partial<ProfileBadgeProps> | null
    return props != null && 'badgeSize' in props && 'userId' in props
}

const injectCustomBadges: RenderPatch<ProfileBadgeRowsProps> = (
    rendered,
    { userId },
) => {
    const userBadges = UsersWithBadges[userId]
    if (!userBadges) return rendered

    return mapElementTree(rendered, element => {
        const { children } = element.props
        if (!Array.isArray(children)) return

        const template = children.find(isProfileBadgeElement)
        if (!template) return

        const ProfileBadge = template.type
        const customBadges: ReactElement[] = []

        for (const id of userBadges) {
            const badge = Badges[id]
            if (!badge) continue

            customBadges.push(
                createElement(
                    patchRender(ProfileBadge, patchCustomBadge, useBadgeStyles),
                    {
                        ...template.props,
                        key: `revenge-badge-${id}`,
                        id,
                        label: badge.label,
                        source: badge.icon,
                    },
                ),
            )
        }

        if (!customBadges.length) return

        return {
            children: [
                ...children.filter(
                    child =>
                        !isProfileBadgeElement(child) ||
                        child.props.id !== DummyBadgeId,
                ),
                ...customBadges,
            ],
        }
    })
}

const patchCustomBadge: RenderPatch<ProfileBadgeProps, BadgeStyles> = (
    rendered,
    { id },
    badgeStyles,
) => {
    const badge = Badges[id as BadgeId]
    if (!badge) return rendered

    const { bnw, showDialog } = badge
    if (!bnw && !showDialog) return rendered

    let tinted = false
    let pressablePatched = false

    // Only patched the most shallow Pressable
    return mapElementTree(rendered, element => {
        if (bnw && !tinted && element.type === Image) {
            tinted = true
            return { style: [element.props.style, badgeStyles.tinted] }
        }

        if (
            showDialog &&
            !pressablePatched &&
            // Match by behaviour, as matching .type === Image picks whichever wrapper component happens to come first
            ('onPress' in element.props ||
                element.props.accessibilityRole === 'button')
        ) {
            pressablePatched = true
            return {
                onPress: () =>
                    openBadgeDialog(id as BadgeId, badge, badgeStyles),
            }
        }

        return undefined
    })
}

const { AlertActionButton, AlertModal, Stack, Text } = Design

function openBadgeDialog(
    id: BadgeId,
    { label, description, bnw, icon }: Badge,
    badgeStyles: BadgeStyles,
): void {
    AlertActionCreators.openAlert(
        `revenge-profile-badge-${id}`,
        <AlertModal
            title={
                <Stack style={styles.stack}>
                    <Image
                        source={icon}
                        style={[styles.display, bnw && badgeStyles.tinted]}
                    />
                    <Text
                        variant="heading-lg/bold"
                        color="mobile-text-heading-primary"
                    >
                        {label}
                    </Text>
                </Stack>
            }
            content={description}
            actions={<AlertActionButton text="OK" />}
        />,
    )
}
