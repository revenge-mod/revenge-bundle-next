import { Tokens } from '@revenge-mod/discord/common/tokens'
import { Design } from '@revenge-mod/discord/design'
import { StyleSheet } from 'react-native'

export const useBadgeStyles = Design.createStyles({
    tinted: {
        tintColor: Tokens.default.colors.MOBILE_TEXT_HEADING_PRIMARY,
    },
})

export const styles = StyleSheet.create({
    stack: {
        alignItems: 'center',
    },
    display: {
        width: 96,
        height: 96,
        objectFit: 'contain',
    },
})
