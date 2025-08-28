import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
    withSingleProp,
} from '@revenge-mod/modules/finders/filters'
import {
    ReactJSXRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'
import type { DiscordModules } from './types'

const { loose, relative } = withDependencies

// design/native.tsx
export let Design: Design = proxify(
    () => {
        // ID: 3236
        // [3237, 1366, 3238, 3239, 2, ...];
        const [module] = lookupModule(
            withProps<Design>('TableRow', 'Button').and(
                withDependencies(
                    loose([
                        null,
                        null,
                        null,
                        relative.withDependencies([2], 1),
                        2,
                        null, // 3009
                        null, // 3010
                        null, // 3011
                        null, // 3012
                        relative.withDependencies([2], 2),
                    ]),
                ).or(
                    // TODO(PalmDevs): Remove once stable channel is > 295203 (for 295203 and below)
                    withDependencies(
                        loose([relative(1), null, relative(2), relative(3), 2]),
                    ),
                ),
            ),
            {
                uninitialized: true,
            },
        )

        if (module) return (Design = module)
    },
    {
        hint: {},
    },
)!

export let FormSwitch: DiscordModules.Components.FormSwitch = proxify(() => {
    // ID: 4655
    // Deps: [46, 175, 27, 180, 2822, 1311, 687, 3358, 1372, 3241, 3242, 4656, 4657, 2]

    // ID: 46
    // Deps: [47, 48, 35, 49]

    const [module] = lookupModule(
        withSingleProp<{
            FormSwitch: DiscordModules.Components.FormSwitch
        }>('FormSwitch').and(
            withDependencies([
                [relative(1), relative(2), null, relative(3)],
                ReactModuleId,
                ReactNativeModuleId,
                ReactJSXRuntimeModuleId,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                relative(1),
                relative(2),
                2,
            ]),
        ),
        {
            uninitialized: true,
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
    TableCheckboxRow: DiscordModules.Components.TableCheckboxRow
    TableRadioGroup: typeof DiscordModules.Components.TableRadioGroup
    TableRadioRow: typeof DiscordModules.Components.TableRadioRow
    TableRow: DiscordModules.Components.TableRow
    TableRowGroup: DiscordModules.Components.TableRowGroup
    TableRowTrailingText: DiscordModules.Components.TableRowTrailingText
    TableSwitchRow: DiscordModules.Components.TableSwitchRow
    Text: DiscordModules.Components.Text
    TextArea: DiscordModules.Components.TextArea
    TextField: DiscordModules.Components.TextField
    TextInput: DiscordModules.Components.TextInput
}
