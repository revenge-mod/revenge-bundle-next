import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import PluginStatesProvider from '../components/PluginStateProvider'
import type { AnyPlugin } from '@revenge-mod/plugins/_'
import type { BrowsePluginActionSheetProps } from '../components/BrowsePluginActionSheet'
import type { PluginOptionsActionSheetProps } from '../components/PluginOptionsActionSheet'

export function showPluginOptionsActionSheet(plugin: AnyPlugin) {
    const KEY = 'plugin-options-action-sheet'

    ActionSheetActionCreators.openLazy(
        import('../components/PluginOptionsActionSheet').then(m => ({
            default: (props: PluginOptionsActionSheetProps) => (
                <PluginStatesProvider>
                    <m.default {...props} plugin={plugin} />
                </PluginStatesProvider>
            ),
        })),
        KEY,
        { plugin, sheetKey: KEY },
    )
}

export function showBrowsePluginActionSheet(
    props: Omit<BrowsePluginActionSheetProps, 'sheetKey'>,
) {
    const KEY = 'browse-plugin-action-sheet'

    ActionSheetActionCreators.openLazy(
        import('../components/BrowsePluginActionSheet'),
        KEY,
        { ...props, sheetKey: KEY },
    )
}
