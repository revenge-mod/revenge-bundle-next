import { getAssetIdByName } from '@revenge-mod/assets'
import { Tokens } from '@revenge-mod/discord/common/tokens'
import { Design } from '@revenge-mod/discord/design'
import { Image, Pressable } from 'react-native'

const { Text } = Design

const PillRipple = { borderless: false }
const PillHitSlop = { top: 12, bottom: 12, left: 4, right: 4 }

const ChevronSmallDownIcon = getAssetIdByName('ChevronSmallDownIcon', 'png')!

export default function Pill({
    label,
    icon,
    trailingIcon = ChevronSmallDownIcon,
    accessibilityLabel,
    onPress,
}: {
    label: string
    icon?: number
    trailingIcon?: number | null
    accessibilityLabel: string
    onPress: () => void
}) {
    const styles_ = usePillStyles()

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityValue={{ text: label }}
            android_ripple={PillRipple}
            hitSlop={PillHitSlop}
            style={styles_.pill}
            onPress={onPress}
        >
            {icon != null && <Image source={icon} style={styles_.pillIcon} />}
            <Text
                color="control-secondary-text-default"
                variant="text-sm/semibold"
                lineClamp={1}
                style={styles_.pillText}
            >
                {label}
            </Text>
            {trailingIcon != null && (
                <Image source={trailingIcon} style={styles_.pillIcon} />
            )}
        </Pressable>
    )
}

const usePillStyles = Design.createStyles({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 1,
        paddingVertical: 2,
        paddingLeft: 8,
        paddingRight: 4,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor:
            Tokens.default.colors.CONTROL_SECONDARY_BACKGROUND_DEFAULT,
        borderWidth: 1,
        borderColor: Tokens.default.colors.CONTROL_SECONDARY_BORDER_DEFAULT,
    },
    pillText: {
        flexShrink: 1,
    },
    pillIcon: {
        tintColor: Tokens.default.colors.CONTROL_SECONDARY_TEXT_DEFAULT,
        width: 14,
        height: 14,
    },
})
