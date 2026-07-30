import { noop } from '@revenge-mod/utils/callback'
import type {
    SettingsItem,
    SettingsModulesLoadedSubscription,
    SettingsSection,
} from '.'

// Sections to splice in the SettingsOverviewScreen
export const sSections: Record<string, SettingsSection> = {}
// SETTING_RENDERER_CONFIG settings
export const sConfig: Record<string, SettingsItem> = {}

export const sSubscriptions = new Set<SettingsModulesLoadedSubscription>()

/**
 * Refresh IDs and re-render callbacks for the settings UI.
 *
 * IDs increment when a refresh is requested.
 * Patches check if they changed and recomputes/rerenders the hooks/components.
 */
export const sRefresher = {
    navigator: 0,
    overviewScreen: 0,
    callNavigator: noop,
    callOverviewScreen: noop,
    callSearchableSettingsList: noop,
}
