import { lookupModule } from '@revenge-mod/modules/finders'
import { withName } from '@revenge-mod/modules/finders/filters'
import type { DiscordModules } from '@revenge-mod/discord/types'
import type { Metro } from '@revenge-mod/modules/types'

// ../discord_common/js/packages/logger/Logger.tsx
export const [Logger, LoggerModuleId] = lookupModule(
    withName<typeof DiscordModules.Logger>('Logger'),
) as [typeof DiscordModules.Logger, Metro.ModuleID]
