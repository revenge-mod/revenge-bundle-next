import { Tokens } from '@revenge-mod/discord/common/tokens'
import { Design } from '@revenge-mod/discord/design'
import { PluginIcon } from './PluginIcon'
import type { NavigatorHeaderWithIconProps } from '../api'

const { NavigatorHeader, createStyles } = Design
const { default: tokens } = Tokens

export default function NavigatorHeaderWithIcon({
    title,
    subtitle,
    icon,
}: NavigatorHeaderWithIconProps) {
    const styles = useNavigatorHeaderStyles()

    return (
        <NavigatorHeader
            icon={
                <PluginIcon
                    icon={icon}
                    size={24}
                    tintColor={styles.tint.color}
                    style={styles.icon}
                />
            }
            title={title}
            subtitle={subtitle}
        />
    )
}

const useNavigatorHeaderStyles = createStyles({
    icon: {
        marginEnd: 8,
    },
    tint: {
        color: tokens.colors.MOBILE_TEXT_HEADING_PRIMARY,
    },
})
