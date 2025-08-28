import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import type { Metro } from '@revenge-mod/modules/types'
import type { DiscordModules } from './types'

const { relative } = withDependencies

// ../discord_common/js/packages/app-start-performance/AppStartPerformance.tsx
export const [AppStartPerformance] = lookupModule(
    withProps<DiscordModules.AppStartPerformance>('markAndLog').and(
        withDependencies([relative(-1), null, null, 2]),
    ),
    {
        uninitialized: true,
    },
) as [DiscordModules.AppStartPerformance, Metro.ModuleID]

AppStartPerformance.mark('👊', 'Pre-init')

import './patches/flux'
