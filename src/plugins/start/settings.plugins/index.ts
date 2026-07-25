import { ToastActionCreators } from '@revenge-mod/discord/actions'
import {
    onSettingsModulesLoaded,
    refreshSettingsNavigator,
    refreshSettingsOverviewScreen,
} from '@revenge-mod/discord/modules/settings'
import {
    InternalPluginFlags,
    isPluginEnabledLate,
    PluginFlags,
    pEmitter,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import {
    refreshAllRepos,
    updateAllPlugins,
} from '@revenge-mod/plugins/_/repositories'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import pluginSettings from '../settings'
import type { PluginApi } from '@revenge-mod/plugins/types'

export interface Storage {
    autoUpdate: boolean
    lastUpdateCheck?: number
}

const OUTDATED_THRESHOLD = 24 * 60 * 60 * 1000 // 1 day
const AUTO_UPDATE_CHECK_DELAY = 10_000

const CircleXIconComponent = lookupGeneratedIconComponent(
    'CircleXIcon',
    'CircleXIcon-primary',
    'CircleXIcon-secondary',
)!

registerInternalPlugin<{ jsonStorage: Storage }>(
    {
        id: 'revenge.settings.plugins',
        name: 'Plugin Settings',
        description: 'Plugin management UI for Revenge.',
        author: 'Revenge',
        icon: 'PuzzlePieceIcon',
        dependencies: { [pluginSettings]: {} },
    },
    {
        jsonStorage: {
            load: true,
            default: {
                autoUpdate: true,
            },
        },
        async start(api_) {
            api = api_

            // @as-require
            import('./plugins')

            onSettingsModulesLoaded(() => {
                // @as-require
                import('./register')
            })

            if (isPluginEnabledLate(api_.plugin)) {
                refreshSettingsOverviewScreen()
                refreshSettingsNavigator()
            }

            pEmitter.addListener('allReposRefreshed', () => {
                api.jsonStorage.set({ lastUpdateCheck: Date.now() })
            })

            const settings = await api.jsonStorage.get()
            if (!settings.autoUpdate) return
            if (
                settings.lastUpdateCheck !== undefined &&
                Date.now() - settings.lastUpdateCheck <= OUTDATED_THRESHOLD
            )
                return

            setTimeout(async () => {
                try {
                    await refreshAllRepos()
                    await updateAllPlugins()
                } catch (e) {
                    ToastActionCreators.open({
                        key: 'PLUGIN_UPDATE_CHECK_FAILED',
                        content: 'Failed to check for plugin updates',
                        IconComponent: CircleXIconComponent,
                    })

                    api.logger.warn('Failed to check for plugin updates', e)
                }
            }, AUTO_UPDATE_CHECK_DELAY)
        },
        stop({ cleanup }) {
            cleanup(refreshSettingsOverviewScreen, refreshSettingsNavigator)
        },
    },
    PluginFlags.Enabled,
    InternalPluginFlags.Internal | InternalPluginFlags.Essential,
)

// Exposed for the Advanced settings screen (auto-update toggle)
export let api: PluginApi<{ jsonStorage: Storage }>
