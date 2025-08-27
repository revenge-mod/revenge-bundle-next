import { lookupModule } from '@revenge-mod/modules/finders'
import {
    preferExports,
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import type { Metro } from '@revenge-mod/modules/types'
import type { DiscordModules } from '../types'

const { relative } = withDependencies

// ../discord_common/js/packages/flux

export const [Dispatcher, DispatcherModuleId] = lookupModule(
    preferExports(
        withProps<DiscordModules.Flux.Dispatcher>('_interceptors'),
        withDependencies([relative(1), null, null, null, null, 2]),
    ),
    {
        uninitialized: true,
    },
) as [DiscordModules.Flux.Dispatcher, Metro.ModuleID]
