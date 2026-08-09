import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { onSettingsModulesLoaded } from '@revenge-mod/discord/modules/settings'
import { JsonStorageUpdateMode } from '@revenge-mod/json-storage'
import { reloadApp } from '@revenge-mod/modules/native/app'
import {
    InternalPluginFlags,
    PluginFlags,
    registerInternalPlugin,
} from '@revenge-mod/plugins/_'
import {
    listAllUpdates,
    refreshAllRepos,
    updateAllPlugins,
} from '@revenge-mod/plugins/_/repositories'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import pluginSettings from '../settings'
import { showPluginUpdatesFoundAlert } from './utils/alerts'
import { addDefaultRepoIfNeeded } from './repos'
import { showErrorToast } from './utils/repos'
import type { JsonStorage } from '@revenge-mod/json-storage'
import type { PluginApi } from '@revenge-mod/plugins/types'

export interface Storage {
    autoUpdate: boolean
    lastUpdateCheck?: number
    defaultRepoRestored?: boolean
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

            const settings = await api.jsonStorage.get()
            autoUpdateService(settings)
            defaultRepoRestoreService(settings, api.jsonStorage)
        },
    },
    PluginFlags.Enabled,
    InternalPluginFlags.Internal | InternalPluginFlags.Essential,
)

function autoUpdateService(settings: Storage) {
    if (!settings.autoUpdate) return
    if (
        settings.lastUpdateCheck !== undefined &&
        Date.now() - settings.lastUpdateCheck <= OUTDATED_THRESHOLD
    )
        return

    setTimeout(async () => {
        try {
            const { errors } = await refreshAllRepos()

            if (errors.length) {
                ToastActionCreators.open({
                    key: 'PLUGIN_UPDATE_CHECK_FAILED',
                    content: 'Failed to refresh some plugin repositories',
                    IconComponent: CircleXIconComponent,
                })
                return
            }

            const { updates } = await listAllUpdates()
            await api.jsonStorage.set({ lastUpdateCheck: Date.now() })

            if (!updates.length) return

            showPluginUpdatesFoundAlert(updates, async () => {
                const { errors: updateErrors } = await updateAllPlugins()

                if (updateErrors.length) {
                    showErrorToast(
                        updateErrors
                            .map(e => `${e.id}: ${e.error}`)
                            .join('\n'),
                    )
                } else {
                    reloadApp()
                }
            })
        } catch (e) {
            ToastActionCreators.open({
                key: 'PLUGIN_UPDATE_CHECK_FAILED',
                content: 'Failed to check for plugin updates',
                IconComponent: CircleXIconComponent,
            })

            api.logger.warn('Failed to check for plugin updates', e)
        }
    }, AUTO_UPDATE_CHECK_DELAY)
}

function defaultRepoRestoreService(
    settings: Storage,
    storage: JsonStorage<Storage>,
) {
    if (!settings.defaultRepoRestored) addDefaultRepoIfNeeded()
    storage.subscribe((update, mode) => {
        // If user cleared storage, restore the default repo if needed
        if (mode === JsonStorageUpdateMode.Load && !update.defaultRepoRestored)
            addDefaultRepoIfNeeded()
    })
}

// Exposed for the Advanced settings screen (auto-update toggle)
export let api: PluginApi<{ jsonStorage: Storage }>
