import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import {
    ReactJSXRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'
import type { DiscordModules } from '../../types'

const { loose, relative } = withDependencies

export type SettingListRenderer =
    DiscordModules.Modules.Settings.SettingListRenderer

// modules/main_tabs_v2/native/settings/renderer/SettingListRenderer.tsx
export let SettingListRenderer: SettingListRenderer = proxify(
    () => {
        const [module] = lookupModule(
            withProps<SettingListRenderer>('SettingsList').and(
                withDependencies(
                    loose([
                        ReactModuleId,
                        ReactNativeModuleId,
                        relative(1),
                        relative(2),
                        null,
                        ReactJSXRuntimeModuleId,
                    ]),
                ),
            ),
            {
                uninitialized: true,
            },
        )

        if (module) return (SettingListRenderer = module)
    },
    {
        hint: {},
    },
)!
