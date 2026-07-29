import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withName,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import type { Metro } from '@revenge-mod/modules/types'
import type { DiscordModules } from './types'

const [, _asyncToGeneratorModuleId] = lookupModule(
    withName('_asyncToGenerator'),
)

// ../discord_common/js/packages/app-start-performance/AppStartPerformance.tsx
export const [AppStartPerformance] = lookupModule(
    withProps<DiscordModules.AppStartPerformance>('markAndLog').and(
        withDependencies([_asyncToGeneratorModuleId, 2]),
    ),
) as [DiscordModules.AppStartPerformance, Metro.ModuleID]

AppStartPerformance.mark('👊', 'Pre-init')

import './patches/import-tracker'
import './patches/flux'
