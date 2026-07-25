import { getAssetIdByName } from '@revenge-mod/assets'
import { Tokens } from '@revenge-mod/discord/common'
import { Design } from '@revenge-mod/discord/design'
import { Image } from 'react-native'

const { NavigatorHeader, createStyles } = Design
const { default: tokens } = Tokens

interface NavigatorHeaderWithIconProps {
    title: string
    icon: string
}

export default function NavigatorHeaderWithIcon({
    title,
    icon,
}: NavigatorHeaderWithIconProps) {
    const styles = useNavigatorHeaderStyles()

    return (
        <NavigatorHeader
            icon={
                <Image style={styles.header} source={getAssetIdByName(icon!)} />
            }
            title={title}
        />
    )
}

const useNavigatorHeaderStyles = createStyles({
    header: {
        width: 24,
        height: 24,
        marginEnd: 8,
        tintColor: tokens.colors.MOBILE_TEXT_HEADING_PRIMARY,
    },
})
