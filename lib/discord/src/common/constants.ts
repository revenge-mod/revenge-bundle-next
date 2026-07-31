import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import type { DiscordModules } from '@revenge-mod/discord/types'

const { loose, relative } = withDependencies

export const [Constants, ConstantsModuleId] = lookupModule(
    withProps<DiscordModules.Constants>('ME')
        .and(
            withDependencies(
                loose([
                    null,
                    relative.withDependencies(loose([relative(2, true)]), 1),
                ]),
            ),
        )
        .keyAs('revenge.discord.common.Constants'),
)
