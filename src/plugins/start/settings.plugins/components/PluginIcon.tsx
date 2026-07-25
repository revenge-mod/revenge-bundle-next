import { getAssetIdByName } from '@revenge-mod/assets'
import { Tokens } from '@revenge-mod/discord/common'
import { Design } from '@revenge-mod/discord/design'
import { Image } from 'react-native'

const PuzzlePieceIcon = getAssetIdByName('PuzzlePieceIcon', 'png')!

export function PluginIcon({
    icon,
    size = 20,
}: {
    icon?: string
    size?: number
}) {
    const styles = usePluginIconStyles()
    // Icons are either a packaged asset name or an inline data: URL, never fetched.
    // Asset icons are monochrome and get tinted, data: URLs render as-is.
    const dataUrl = icon?.startsWith('data:')

    return (
        <Image
            source={
                dataUrl
                    ? { uri: icon }
                    : icon
                      ? (getAssetIdByName(icon) ?? PuzzlePieceIcon)
                      : PuzzlePieceIcon
            }
            style={[!dataUrl && styles.icon, { width: size, height: size }]}
        />
    )
}

const usePluginIconStyles = Design.createStyles({
    icon: {
        tintColor: Tokens.default.colors.TEXT_DEFAULT,
    },
})
