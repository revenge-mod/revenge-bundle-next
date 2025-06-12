import { FormSwitch as Switch } from '@revenge-mod/discord/design'
import { View } from 'react-native'
import { styles } from './_internal'
import type { DiscordModules } from '@revenge-mod/discord/types'

/**
 * A switch component that is styled to match Discord's configuration
 */
export default function FormSwitch(
    props: DiscordModules.Components.FormSwitchProps,
) {
    return (
        <View style={props.disabled && styles.disabled}>
            <Switch {...props} />
        </View>
    )
}
