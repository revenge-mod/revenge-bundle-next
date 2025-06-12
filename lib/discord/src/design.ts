import {
    byDependencies,
    byProps,
    bySingleProp,
    looseDeps,
    preferExports,
    relativeDep,
} from '@revenge-mod/modules/finders/filters'
import { lookupModule } from '@revenge-mod/modules/finders/lookup'
import {
    ReactJsxRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'
import type { DiscordModules } from './types'

// design/native.tsx
export let Design: Design = proxify(
    () => {
        // ID: 3236
        // [3237, 1366, 3238, 3239, 2, ...];
        const [module] = lookupModule(
            preferExports(
                byProps<Design>('TableRow', 'Button'),
                byDependencies(
                    looseDeps([
                        relativeDep(1),
                        undefined,
                        relativeDep(2),
                        relativeDep(3),
                        2,
                    ]),
                ),
            ),
            {
                includeUninitialized: true,
            },
        )

        if (module) return (Design = module)
    },
    {
        hint: 'object',
    },
)!

export let FormSwitch: DiscordModules.Components.FormSwitch = proxify(() => {
    // ID: 4655
    // Deps: [46, 175, 27, 180, 2822, 1311, 687, 3358, 1372, 3241, 3242, 4656, 4657, 2]

    // ID: 46
    // Deps: [47, 48, 35, 49]

    const [module] = lookupModule(
        preferExports(
            bySingleProp<{ FormSwitch: DiscordModules.Components.FormSwitch }>(
                'FormSwitch',
            ),
            byDependencies([
                [relativeDep(1), relativeDep(2), undefined, relativeDep(3)],
                ReactModuleId,
                ReactNativeModuleId,
                ReactJsxRuntimeModuleId,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                relativeDep(1),
                relativeDep(2),
                2,
            ]),
        ),
        {
            includeUninitialized: true,
        },
    )

    if (module) return (FormSwitch = module.FormSwitch)
})!

export interface Design {
    createStyles: DiscordModules.Components.Styles.CreateStylesFunction
    useTooltip: DiscordModules.Components.UseTooltipFunction

    ActionSheet: DiscordModules.Components.ActionSheet
    ActionSheetRow: DiscordModules.Components.ActionSheetRow
    ActionSheetSwitchRow: DiscordModules.Components.ActionSheetSwitchRow
    BottomSheetTitleHeader: DiscordModules.Components.BottomSheetTitleHeader
    AlertActionButton: DiscordModules.Components.AlertActionButton
    AlertModal: DiscordModules.Components.AlertModal
    Button: DiscordModules.Components.Button
    Card: DiscordModules.Components.Card
    ContextMenu: DiscordModules.Components.ContextMenu
    ContextMenuItem: DiscordModules.Components.ContextMenuItem
    IconButton: DiscordModules.Components.IconButton
    ImageButton: DiscordModules.Components.ImageButton
    LayerScope: DiscordModules.Components.LayerScope
    NavigatorHeader: DiscordModules.Components.NavigatorHeader
    Stack: DiscordModules.Components.Stack
    Slider: DiscordModules.Components.Slider
    TableRow: DiscordModules.Components.TableRow
    TableRowGroup: DiscordModules.Components.TableRowGroup
    TableRowTrailingText: DiscordModules.Components.TableRowTrailingText
    TableSwitchRow: DiscordModules.Components.TableSwitchRow
    Text: DiscordModules.Components.Text
    TextArea: DiscordModules.Components.TextArea
    TextField: DiscordModules.Components.TextField
    TextInput: DiscordModules.Components.TextInput
}
