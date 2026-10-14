import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { onSettingsModulesLoaded } from '@revenge-mod/discord/modules/settings'
import { NetInfo } from '@revenge-mod/externals/react-native-community'
import { JsonStorageUpdateMode } from '@revenge-mod/json-storage'
import { pList, registerInternalPlugin } from '@revenge-mod/plugins/_'
import {
    refreshAllRepos,
    updateAllPlugins,
} from '@revenge-mod/plugins/_/repositories'
import { createElement } from 'react'
import { claimPlugins } from './claims'
import defer * as NavigatorHeaderWithIconModule from './components/NavigatorHeaderWithIcon'
import defer * as PluginIconModule from './components/PluginIcon'
import manifest from './manifest.json'
import { addDefaultRepoIfNeeded } from './repos'
import defer * as BrowseScreen from './screens/RevengePluginsBrowseSettingScreen'
import defer * as PluginsScreen from './screens/RevengePluginsSettingScreen'
import { showPluginOptionsActionSheet } from './utils/sheets'
import type { JsonStorage } from '@revenge-mod/json-storage'
import type { PluginApi } from '@revenge-mod/plugins/types'
import type {
    BrowsePageProps,
    PluginSettingsComponents,
    PluginsPageProps,
} from './api'

export interface Storage {
    autoUpdate: boolean
    skipUpdatesOnExpensiveNetwork?: boolean
    lastUpdateCheck?: number
    defaultRepoRestored?: boolean
}

const OUTDATED_THRESHOLD = 60 * 60 * 1000 // 1 hour
const AUTO_UPDATE_CHECK_DELAY = 10_000

registerInternalPlugin<{ jsonStorage: Storage }>(manifest, {
    jsonStorage: {
        load: true,
        default: {
            autoUpdate: true,
        },
    },
    async start(api_) {
        api = api_

        api.decorate(plugin => {
            plugin.api.pluginSettings = {
                showPluginOptionsSheet(id) {
                    const target = pList.get(id)
                    if (!target) throw new Error(`Plugin not installed: ${id}`)
                    showPluginOptionsActionSheet(target)
                },
                claimPlugins(match) {
                    const unclaim = claimPlugins(match)
                    plugin.api.cleanup(unclaim)
                    return unclaim
                },
                PluginsPage,
                BrowsePage,
                components,
            }
        })

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
})

function autoUpdateService(settings: Storage) {
    if (!settings.autoUpdate) return
    if (
        settings.lastUpdateCheck !== undefined &&
        Date.now() - settings.lastUpdateCheck <= OUTDATED_THRESHOLD
    )
        return

    setTimeout(async () => {
        try {
            if (settings.skipUpdatesOnExpensiveNetwork) {
                const { details } = await NetInfo.fetch()
                if (details?.isConnectionExpensive) return
            }

            const { errors } = await refreshAllRepos()
            await updateAllPlugins()

            if (!errors.length)
                await api.jsonStorage.set({
                    lastUpdateCheck: Date.now(),
                })
        } catch (e) {
            ToastActionCreators.open('REVENGE_PLUGIN_UPDATE_CHECK_FAILED', {
                text: 'Failed to check for plugin updates',
                variant: 'critical',
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

function PluginsPage(props: PluginsPageProps) {
    return createElement(PluginsScreen.PluginsPage, props)
}

function BrowsePage(props: BrowsePageProps) {
    return createElement(BrowseScreen.BrowsePage, props)
}

const components: PluginSettingsComponents = {
    PluginIcon: props => createElement(PluginIconModule.PluginIcon, props),
    NavigatorHeaderWithIcon: props =>
        createElement(NavigatorHeaderWithIconModule.default, props),
}

// Exposed for the Advanced settings screen (auto-update toggle)
export let api: PluginApi<{ jsonStorage: Storage }>
