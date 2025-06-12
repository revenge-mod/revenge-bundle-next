import { Design } from '@revenge-mod/discord/design'
import { PageSpacing, styles } from './_internal'
import type { DiscordModules } from '@revenge-mod/discord/types'

export default function Page(props: DiscordModules.Components.StackProps) {
    return (
        <Design.Stack
            spacing={PageSpacing}
            style={[styles.grow, styles.pagePadding]}
            {...props}
        >
            {props.children}
        </Design.Stack>
    )
}
