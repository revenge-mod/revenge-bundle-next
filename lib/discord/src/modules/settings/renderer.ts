import { lookupModule } from '@revenge-mod/modules/finders'
import {
    anyOf,
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import {
    ReactJSXRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'
import { ImportTrackerModuleId } from '../../patches/import-tracker'
import type { DiscordModules } from '../../types'

const { loose, relative, last } = withDependencies

export type SettingListRenderer =
    DiscordModules.Modules.Settings.SettingListRenderer

// modules/settings/native/renderer/SettingListRenderer.tsx
export let SettingListRenderer: SettingListRenderer = proxify(
    () => {
        const [module] = lookupModule(
            withProps<SettingListRenderer>('SettingsList')
                .and(
                    anyOf(
                        withDependencies(
                            loose([
                                ReactModuleId,
                                ReactNativeModuleId,
                                relative(1),
                            ]),
                        ).and(withDependencies(last([ImportTrackerModuleId]))),
                        // TODO: Remove this once stable > 344205
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
