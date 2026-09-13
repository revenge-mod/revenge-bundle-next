import { lookupModule, lookupModules } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withoutProps,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import {
    ReactJSXRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'
import { DispatcherModuleId } from './common/flux'
import { ImportTrackerModuleId } from './common/import-tracker'
import type { DiscordModules } from './types'

const { relative, ordered } = withDependencies

// modules/action_sheet/native/ActionSheetActionCreators.tsx
export let ActionSheetActionCreators: DiscordModules.Actions.ActionSheetActionCreators =
    proxify(
        () => {
            const [module] = lookupModule(
                withProps<DiscordModules.Actions.ActionSheetActionCreators>(
                    'hideActionSheet',
                    'openLazy',
                ).and(
                    withDependencies(
                        ordered([
                            ReactModuleId,
                            ReactJSXRuntimeModuleId,
                            DispatcherModuleId,
                            relative(1),
                            relative(2),
                            ImportTrackerModuleId,
                        ]),
                    ),
                ),
            )

            if (module) return (ActionSheetActionCreators = module)
        },
        {
            hint: {},
        },
    )!

// actions/native/AlertActionCreators.tsx
export let AlertActionCreators: DiscordModules.Actions.AlertActionCreators =
    proxify(
        () => {
            const [module] = lookupModule(
                withProps<DiscordModules.Actions.AlertActionCreators>(
                    'openAlert',
                ).and(
                    withDependencies([
                        null,
                        null,
                        [ReactNativeModuleId, ImportTrackerModuleId],
                        relative(1),
                        // TODO: Shifted from +2 to +3 on 344201+
                        relative.within(2, 3),
                        ImportTrackerModuleId,
                    ]),
                ),
            )

            if (module) return (AlertActionCreators = module)
        },
        {
            hint: {},
        },
    )!

// modules/toast/native/ToastActionCreators.tsx
export let ToastActionCreators: DiscordModules.Actions.ToastActionCreators =
    proxify(() => {
        // [Dispatcher, ImportTracker]
        // Many other modules share the same dependencies, the second yielded should be the correct module.

        const generator = lookupModules(
            withProps<DiscordModules.Actions.ToastActionCreators>('open')
                .and(withoutProps('init'))
                .and(
                    withDependencies([
                        DispatcherModuleId,
                        ImportTrackerModuleId,
                    ]),
                ),
        )

        for (const [module] of generator)
            if (module.open.length === 1) return (ToastActionCreators = module)
    })!
