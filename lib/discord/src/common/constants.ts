import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import type { DiscordModules } from '@revenge-mod/discord/types'

const { partial, relative } = withDependencies

export const [Constants, ConstantsModuleId] = lookupModule(
    withProps<DiscordModules.Constants>('ME')
        .and(
            withDependencies(
                partial([
                    null,
                    relative.withDependencies(partial([relative(2, true)]), 1),
                ]),
            ),
        )
        .keyAs('revenge.discord.common.Constants'),
)
