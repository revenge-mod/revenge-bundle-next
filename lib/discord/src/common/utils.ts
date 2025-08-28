import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withName,
} from '@revenge-mod/modules/finders/filters'
import { proxify } from '@revenge-mod/utils/proxy'
import type { DiscordModules } from '../types'

const [, _createClassModuleId] = lookupModule(withName('_createClass'))
const [, _classCallCheckModuleId] = lookupModule(withName('_classCallCheck'))

// ../discord_common/js/shared/utils/TypedEventEmitter.tsx
/**
 * Do not use the `error` event, as the module will handle it specially for some reason.
 */
export let TypedEventEmitter: typeof DiscordModules.Utils.TypedEventEmitter =
    proxify(() => {
        const [module] = lookupModule(
            withName<typeof DiscordModules.Utils.TypedEventEmitter>(
                'TypedEventEmitter',
            ).and(
                withDependencies([
                    _classCallCheckModuleId,
                    _createClassModuleId,
                    [],
                    2,
                ]),
            ),
            {
                uninitialized: true,
            },
        )

        if (module) return (TypedEventEmitter = module)
    })!
