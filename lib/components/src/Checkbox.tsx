import { styles } from '@revenge-mod/components/_'
import { Design } from '@revenge-mod/discord/design'
import { View } from 'react-native'
import type { DiscordModules } from '@revenge-mod/discord/types'
import type { ViewProps } from 'react-native'

// Makes sure no props would conflict (if it did, we should define a behavior for it)
type __TypeConflictCheck =
    Extract<
        keyof DiscordModules.Components.CheckboxProps,
        keyof ViewProps
    > extends never
        ? true
        : false

true satisfies __TypeConflictCheck

const { Checkbox: DiscordCheckbox } = Design

/**
 * A checkbox component with disabled state support, wrapping Discord's component.
 */
export default function Checkbox({
    disabled,
    ...rest
}: DiscordModules.Components.CheckboxProps & {
    disabled?: boolean
} & ViewProps) {
    return (
        <View
            style={disabled && styles.disabled}
            accessibilityRole="checkbox"
            aria-checked={rest.checked}
            {...rest}
        >
            <View style={styles.passthrough} aria-hidden>
                <DiscordCheckbox {...rest} />
            </View>
        </View>
    )
}
