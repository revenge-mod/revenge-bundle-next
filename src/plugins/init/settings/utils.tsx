import { getAssetIdByName } from '@revenge-mod/assets'
import { Tokens } from '@revenge-mod/discord/common'
import { Stores } from '@revenge-mod/discord/common/flux'
import { Design } from '@revenge-mod/discord/design'
import { RootNavigationRef } from '@revenge-mod/discord/modules/main_tabs_v2'
import { _metas } from '@revenge-mod/plugins/_'
import { createElement } from 'react'
import { Image } from 'react-native'
import { RouteNames, Setting } from './constants'
import type { ReactNavigationParamList } from '@revenge-mod/externals/react-navigation'
import type { Plugin, PluginApi } from '@revenge-mod/plugins/types'

const { NavigatorHeader } = Design

// TODO(plugins/settings): Register a custom route instead, so plugin "settings" can actually be pinned and navigated to without hassle.
// This would require us to implement the event-based plugin management system first, so we can listen to plugin enable/disable events and update the settings accordingly.
export function navigatePluginSettings(plugin: Plugin) {
    const [api] = _metas.get(plugin.manifest.id)!
    const navigation =
        RootNavigationRef.getRootNavigationRef<ReactNavigationParamList>()
    if (!navigation.isReady()) return

    navigation.navigate(RouteNames[Setting.RevengeCustomPage], {
        render: () =>
            createElement(plugin.SettingsComponent!, {
                api: api as PluginApi,
            }),
        options: plugin.manifest.icon
            ? {
                  headerTitle: () => (
                      <NavigatorHeader
                          icon={
                              <Image
                                  style={{
                                      width: 24,
                                      height: 24,
                                      marginEnd: 8,
                                      tintColor:
                                          Tokens.default.internal.resolveSemanticColor(
                                              Stores.ThemeStore.theme,
                                              Tokens.default.colors
                                                  .HEADER_PRIMARY,
                                          ),
                                  }}
                                  source={getAssetIdByName(
                                      plugin.manifest.icon!,
                                  )}
                              />
                          }
                          title={plugin.manifest.name}
                      />
                  ),
              }
            : {
                  title: plugin.manifest.name,
              },
    })
}
