import {
    byDependencies,
    byProps,
    preferExports,
} from '@revenge-mod/modules/finders/filters'
import { lookupModule } from '@revenge-mod/modules/finders/lookup'
import {
    ReactJsxRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'
import type { DiscordModules } from '../../types'

const { loose, relative } = byDependencies

export type SettingListRenderer =
    DiscordModules.Modules.Settings.SettingListRenderer

export let SettingListRenderer: SettingListRenderer = proxify(
    () => {
        const [module] = lookupModule(
            preferExports(
                byProps<SettingListRenderer>('SettingsList'),
                byDependencies(
                    loose([
                        ReactModuleId,
                        ReactNativeModuleId,
                        relative(1),
                        relative(2),
                        undefined,
                        ReactJsxRuntimeModuleId,
                    ]),
                ),
            ),
            {
                includeUninitialized: true,
            },
        )

        if (module) return (SettingListRenderer = module)
    },
    {
        hint: 'object',
    },
)!
