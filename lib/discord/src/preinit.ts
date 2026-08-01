import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withName,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { ImportTrackerModuleId } from './patches/import-tracker'
import type { Metro } from '@revenge-mod/modules/types'
import type { DiscordModules } from './types'

const [, _asyncToGeneratorModuleId] = lookupModule(
    withName('_asyncToGenerator'),
)
const [, _classCallCheckModuleId] = lookupModule(withName('_classCallCheck'))
const [, _createClassModuleId] = lookupModule(withName('_createClass'))

// ../discord_common/js/packages/app-start-performance/AppStartPerformance.tsx
export const [AppStartPerformance] = lookupModule(
    withProps<DiscordModules.AppStartPerformance>('markAndLog').and(
        withDependencies([_asyncToGeneratorModuleId, ImportTrackerModuleId]).or(
            // TODO: Remove once stable >341202
            withDependencies([
                _asyncToGeneratorModuleId,
                _classCallCheckModuleId,
                _createClassModuleId,
                ImportTrackerModuleId,
            ]),
        ),
    ),
) as [DiscordModules.AppStartPerformance, Metro.ModuleID]

AppStartPerformance.mark('👊', 'Pre-init')

import './patches/flux'
