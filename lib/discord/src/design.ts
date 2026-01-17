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
import { ImportTrackerModuleId } from './common'
import type { DiscordModules } from './types'

const { loose, relative } = withDependencies

// design/native.tsx
export let Design: Design = proxify(
    () => {
        // ID: 3236
        // [3237, 1366, 3238, 3239, 2, ...];
        const [module] = lookupModule(
            withProps<Design>('TableRow', 'Button')
                .and(
                    withDependencies(
                        loose([
                            null,
                            null,
                            withDependencies([
                                ReactNativeModuleId,
                                ImportTrackerModuleId,
                            ]),
                            withDependencies([ImportTrackerModuleId]),
                            ImportTrackerModuleId,
                        ]),
                    ),
                )
                .keyAs('revenge.discord.design.Design'),
        )

        if (module) return (Design = module)
    },
    {
        hint: {},
    },
)!

// design/components/Forms/native/FormSwitch.native.tsx
export let FormSwitch: DiscordModules.Components.FormSwitch = proxify(() => {
    const [module] = lookupModule(
        withSingleProp<{
            FormSwitch: DiscordModules.Components.FormSwitch
        }>('FormSwitch').and(
            withDependencies([
                null,
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
                // Checkmark and X icons
                relative(1),
                relative(2),
                ImportTrackerModuleId,
            ]),
        ),
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
    TableSwitchRow: DiscordModules.Components.TableSwitchRow
    Text: DiscordModules.Components.Text
    TextArea: DiscordModules.Components.TextArea
    TextField: DiscordModules.Components.TextField
    TextInput: DiscordModules.Components.TextInput
}
