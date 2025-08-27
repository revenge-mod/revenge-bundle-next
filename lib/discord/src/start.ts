import { waitForModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import { sConfig, sSubscriptions } from './modules/settings/_internal'
import type { SettingsItem } from './modules/settings'

export let sLoaded = false

const unsubSRC = waitForModules(
    withProps<{ SETTING_RENDERER_CONFIG: Record<string, SettingsItem> }>(
        'SETTING_RENDERER_CONFIG',
    ),
    SettingRendererConfig => {
        unsubSRC()

        sLoaded = true

        for (const sub of sSubscriptions)
            try {
                sub()
            } catch {}

        // We don't ever need to call this again
        sSubscriptions.clear()

        let { SETTING_RENDERER_CONFIG: ORIGINAL } = SettingRendererConfig

        Object.defineProperty(
            SettingRendererConfig,
            'SETTING_RENDERER_CONFIG',
            {
                get: () =>
                    ({
                        ...ORIGINAL,
                        ...sConfig,
                    }) as Record<string, SettingsItem>,
                set: v => (ORIGINAL = v),
            },
        )
    },
    {
        cached: true,
    },
)
