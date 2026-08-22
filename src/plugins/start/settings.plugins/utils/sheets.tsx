import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import type { AnyPlugin } from '@revenge-mod/plugins/_'
import type { BrowsePluginActionSheetProps } from '../components/BrowsePluginActionSheet'

export function showPluginOptionsActionSheet(plugin: AnyPlugin) {
    const KEY = 'plugin-options-action-sheet'

    ActionSheetActionCreators.openLazy(
        import('../components/PluginOptionsActionSheet'),
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
