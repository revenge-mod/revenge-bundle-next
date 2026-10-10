import { lookupModule, lookupModules } from '@revenge-mod/modules/finders'
import {
    anyOf,
    withDependencies,
    withoutProps,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { getModuleDependencies } from '@revenge-mod/modules/metro/utils'
import {
    ReactJSXRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'
import { DispatcherModuleId } from './common/flux'
import { ImportTrackerModuleId } from './common/import-tracker'
import type { Metro } from '@revenge-mod/modules/types'
import type { DiscordModules } from './types'

const { atMost, relative, ordered } = withDependencies

// modules/action_sheet/native/ActionSheetActionCreators.tsx
export let [ActionSheetActionCreators, ActionSheetActionCreatorsModuleId]: [
    DiscordModules.Actions.ActionSheetActionCreators,
    Metro.ModuleID,
] = proxify(
    () => {
        const [module, id] = lookupModule(
            withProps<DiscordModules.Actions.ActionSheetActionCreators>(
                'hideActionSheet',
                'openLazy',
            )
                // TODO: Redo this on 350204+
                .and(
                    withDependencies(
                        ordered([
                            ReactModuleId,
                            ReactJSXRuntimeModuleId,
                            relative.withDependencies(
                                ordered([
                                    relative(2, true),
                                    relative(3, true),
                                    ImportTrackerModuleId,
                                ]),
                                1,
                            ),
                            relative(2),
                        ]),
                    ),
                )
                .and(
                    withDependencies(
                        ordered([DispatcherModuleId, ImportTrackerModuleId]),
                    ),
                )
                .keyAs('revenge.discord.actions.ActionSheetActionCreators'),
        )

        if (module) {
            ActionSheetActionCreators = module
            ActionSheetActionCreatorsModuleId = id!
            return [module, id!]
        }
    },
    {
        hint: {},
    },
)!

// actions/native/AlertActionCreators.tsx
export let [AlertActionCreators, AlertActionCreatorsModuleId]: [
    DiscordModules.Actions.AlertActionCreators,
    Metro.ModuleID,
] = proxify(
    () => {
        const [module, id] = lookupModule(
            withProps<DiscordModules.Actions.AlertActionCreators>('openAlert')
                .and(
                    withDependencies([
                        null,
                        null,
                        [ReactNativeModuleId, ImportTrackerModuleId],
                        relative(1),
                        relative(3),
                        ImportTrackerModuleId,
                    ]),
                )
                .keyAs('revenge.discord.actions.AlertActionCreators'),
        )

        if (module) {
            AlertActionCreators = module
            AlertActionCreatorsModuleId = id!
            return [module, id!]
        }
    },
    {
        hint: {},
    },
)!

// modules/toast/native/ToastActionCreators.tsx
export let [ToastActionCreators, ToastActionCreatorsModuleId]: [
    DiscordModules.Actions.ToastActionCreators,
    Metro.ModuleID,
] = proxify(
    () => {
        const generator = lookupModules(
            withProps<DiscordModules.Actions.ToastActionCreators>(
                'open',
                'close',
            )
                .and(
                    anyOf(
                        // TODO: Remove atMost and ordered when stable > 350204
                        withDependencies(
                            atMost(
                                3,
                                ordered([
                                    relative.withDependencies(
                                        [ImportTrackerModuleId, relative(1)],
                                        1,
                                    ),
                                    ImportTrackerModuleId,
                                ]),
                            ),
                        ),
                        // TODO: Remove when stable > 350204
                        anyOf(
                            // [useToastStore (+1), DesignSystemsNotificationComponents, toManaToast, Dispatcher, ImportTracker]
                            withDependencies(
                                ordered([
                                    // useToastStore: [ImportTracker, +1]
                                    relative.withDependencies(
                                        [ImportTrackerModuleId, relative(1)],
                                        1,
                                    ),
                                    // toManaToast: [+1, ImportTracker]
                                    [relative(1), ImportTrackerModuleId],
                                    DispatcherModuleId,
                                    ImportTrackerModuleId,
                                ]),
                            ),
                            // TODO: Remove when stable > 349205
                            // Many other modules share the same dependencies, the second yielded should be the correct module.
                            withDependencies([
                                DispatcherModuleId,
                                ImportTrackerModuleId,
                            ]).and(withoutProps('init')),
                        ),
                    ),
                )
                .keyAs('revenge.discord.actions.ToastActionCreators'),
        )

        for (const [module, id] of generator)
            if (
                getModuleDependencies(id)![0] === ImportTrackerModuleId
                    ? module.open.length === 1
                    : true
            ) {
                ToastActionCreators = module
                ToastActionCreatorsModuleId = id
                return [module, id]
            }
    },
    {
        hint: {},
    },
)!
