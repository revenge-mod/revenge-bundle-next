// @revenge-mod/types/plugins/settings.plugins

import type { AssetId } from '@revenge-mod/assets/types'
import type { FunctionComponent } from 'react'
import type { ImageStyle, StyleProp } from 'react-native'

export interface PluginSettingsApi {
    /** Opens the options sheet of the installed plugin with ID {@link id}, matching the Plugins page. Throws if uninstalled. */
    showPluginOptionsSheet(id: string): void
    /** Opens the settings page of the installed plugin with ID {@link id}, matching the Plugins page. Throws if uninstalled. */
    openPluginSettings(id: string): void
    /** Returns whether the installed plugin with ID {@link id} has a settings page. Throws if uninstalled. */
    hasPluginSettings(id: string): boolean
    /**
     * Moves plugins matching {@link match} off the Plugins and Browse Plugins pages, whether installed or not,
     * for caller pages rendering {@link PluginsPage} and {@link BrowsePage}.
     *
     * Call the unpatch function or stop the plugin to remove the claim and restore visibility.
     */
    claimPlugins(match: PluginMatch): () => void
    /** The Plugins page (search, filter, sort, cards, and options), showing only installed plugins matching `match`. */
    PluginsPage: FunctionComponent<PluginsPageProps>
    /** The Browse Plugins page (search, filter, sort, cards, and install flow), showing only listings matching `match`. */
    BrowsePage: FunctionComponent<BrowsePageProps>
    components: PluginSettingsComponents
}

export interface PluginSettingsComponents {
    /** Renders a plugin manifest icon with puzzle piece fallback. */
    PluginIcon: FunctionComponent<PluginIconProps>
    /** Settings page header featuring plugin icon. */
    NavigatorHeaderWithIcon: FunctionComponent<NavigatorHeaderWithIconProps>
}

export interface PluginIconProps {
    /** Asset name or `data:` URL, matching plugin manifest icons. */
    icon?: string
    defaultIcon?: AssetId
    /** @default 20 */
    size?: number
    /** Tints with the critical color instead. */
    danger?: boolean
    /** Custom tint color for asset icons. `data:` URLs render untinted. */
    tintColor?: string
    style?: StyleProp<ImageStyle>
}

export interface NavigatorHeaderWithIconProps {
    title: string
    subtitle?: string
    /** Asset name or `data:` URL, matching plugin manifest icons. */
    icon?: string
}

/**
 * Plugin metadata evaluated by claim filters.
 * Sourced from the manifest for installed plugins, or default channel version for repository listings.
 */
export interface PluginMatchInfo {
    id: string
    name: string
    description: string
    author: string
    dependencies: Record<string, { optional: boolean }>
}

export type PluginMatch = (plugin: PluginMatchInfo) => boolean

export interface PluginsPageProps {
    match: PluginMatch
    /** Opens the matching Browse page from the add button. Defaults to Browse Plugins. */
    onBrowse?: () => void
}

export interface BrowsePageProps {
    match: PluginMatch
    /** Message rendered when no listings match. */
    empty?: string
}

declare module '@revenge-mod/plugins/types' {
    interface PluginApi<O extends PluginApiExtensionsOptions> {
        pluginSettings: PluginSettingsApi
    }
}
