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
import type { DiscordModules } from './types'

const { relative } = withDependencies

// modules/action_sheet/native/ActionSheetActionCreators.tsx
export let ActionSheetActionCreators: DiscordModules.Actions.ActionSheetActionCreators =
    proxify(
        () => {
            const [module] = lookupModule(
                withProps<DiscordModules.Actions.ActionSheetActionCreators>(
                    'hideActionSheet',
                    'openLazy',
                ).and(
                    withDependencies([
                        null,
                        ReactModuleId,
                        ReactJSXRuntimeModuleId,
                        DispatcherModuleId,
                        relative(1),
                        relative(2),
                        2,
                    ]),
                ),
                {
                    uninitialized: true,
                },
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
                        [[], relative(1)],
                        [ReactNativeModuleId, 2],
                        2,
                    ]),
                ),
                {
                    uninitialized: true,
                },
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
        // Many other modules share the same dependencies, the second yielded should be the correct module.
        // [Dispatcher, ImportTracker]

        const generator = lookupModules(
            withProps<DiscordModules.Actions.ToastActionCreators>('open')
                .and(withoutProps('init'))
                .and(withDependencies([DispatcherModuleId, 2])),
            {
                uninitialized: true,
            },
        )

        for (const [module] of generator)
            if (module.open.length === 1) return (ToastActionCreators = module)
    })!
