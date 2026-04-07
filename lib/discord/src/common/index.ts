import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withName,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { proxify } from '@revenge-mod/utils/proxy'
import type { Metro } from '@revenge-mod/modules/types'
import type { DiscordModules } from '../types'

export { AppStartPerformance } from '../preinit'
export * as flux from './flux'
export * as utils from './utils'

const { loose, relative } = withDependencies

// ../discord_common/js/packages/logger/Logger.tsx
export const [Logger, LoggerModuleId] = lookupModule(
    withName<typeof DiscordModules.Logger>('Logger'),
) as [typeof DiscordModules.Logger, Metro.ModuleID]

// ../discord_common/js/packages/tokens/native.tsx
export const [Tokens, TokensModuleId] = lookupModule(withProps('RawColor')) as [
    any,
    Metro.ModuleID,
]

/**
 * If you need to use this ID, unproxify {@link Constants} first.
 *
 * ```js
 * preinit() {
 *   unproxify(Constants)
 *   // Module ID will now be set!
 *   ConstantsModuleId // ...
 * }
 * ```
 */
export let ConstantsModuleId: Metro.ModuleID | undefined
export let Constants: DiscordModules.Constants = proxify(
    () => {
        const [module, id] = lookupModule(
            withProps<DiscordModules.Constants>('ME')
                .and(
                    withDependencies(
                        loose([
                            null,
                            relative.withDependencies(
                                loose([relative(2, true)]),
                                1,
                            ),
                        ]),
                    ),
                )
                .keyAs('revenge.discord.common.Constants'),
        )

        if (module) {
            ConstantsModuleId = id
            return (Constants = module)
        }
    },
    { hint: {} },
)!

export { ImportTrackerModuleId } from '../patches/import-tracker'
