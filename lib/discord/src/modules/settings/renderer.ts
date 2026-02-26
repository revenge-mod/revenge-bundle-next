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

// modules/settings/native/renderer/SettingListRenderer.tsx
export let SettingListRenderer: SettingListRenderer = proxify(
    () => {
        const [module] = lookupModule(
            withProps<SettingListRenderer>('SettingsList')
                .and(
                    // TODO: Remove once stable >319203
                    withDependencies(
                        loose([
                            ReactModuleId,
                            ReactNativeModuleId,
                            relative(1),
                            relative(2),
                            null,
                            ReactJSXRuntimeModuleId,
                        ]),
                    ).or(
                        withDependencies(
                            loose([
                                ReactModuleId,
                                ReactNativeModuleId,
                                null,
                                relative(1),
                                null,
                                ReactJSXRuntimeModuleId,
                            ]),
                        ),
                    ),
                )
                .keyAs(
                    'revenge.discord.modules.settings.renderer.SettingListRenderer',
                ),
        )

        if (module) return (SettingListRenderer = module)
    },
    {
        hint: {},
    },
)!
