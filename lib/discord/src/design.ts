import { lookupModule, lookupModules } from '@revenge-mod/modules/finders'
import { withDependencies, withProps } from '@revenge-mod/modules/finders/filters'
import {
    ReactJSXRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'
import { ImportTrackerModuleId } from './common/import-tracker'
import type { DiscordModules } from './types'

const { atLeast, last, loose, relative } = withDependencies

/**
 * The lowest amount of dependencies `design/native.tsx` is expected to have.
 *
 * It's a barrel module exporting the whole design system,
 * so it always has a lot of dependencies (~140 as of 341202).
 *
 * This is only used as a filter, and is checked before anything else for performance reasons.
 */
const DesignMinimumDependencies = 64

// design/native.tsx
export let Design: Design = proxify(
    () => {
        // ID: 13171
        // [3909, 4608, 5182, 13172, 2, ...] (141 dependencies)
        const [module] = lookupModule(
            withProps('TableRow', 'Button').and(
            withDependencies<Design>(
                    atLeast(DesignMinimumDependencies, [
                        [ImportTrackerModuleId],
                        [ImportTrackerModuleId],
                        [ReactNativeModuleId, ImportTrackerModuleId],
                        [ImportTrackerModuleId],
                        ImportTrackerModuleId,
                    ]),
                )
            ).keyAs('revenge.discord.design.Design'),
        )

        if (module) return (Design = module)
    },
    {
        hint: {},
    },
)!

// design/components/Forms/native/FormSwitch.native.tsx
export let FormSwitch: DiscordModules.Components.FormSwitch = proxify(() => {
    for (const [, id] of lookupModules(
        withDependencies(
            loose([
                null,
                ReactModuleId,
                ReactNativeModuleId,
                ReactJSXRuntimeModuleId,
            ]),
        )
            .and(
                withDependencies(
                    last([
                        relative(1),
                        relative(2),
                        null,
                        null,
                        ImportTrackerModuleId,
                    ]),
                ),
            )
            .keyAs('revenge.discord.design.FormSwitch'),
        {
            initialize: false,
        },
    )) {
        const FormSwitch_ = __r(id)!.FormSwitch
        if (FormSwitch_) return (FormSwitch = FormSwitch_)
    }
})!

export interface Design {
    createStyles: DiscordModules.Components.Styles.CreateStylesFunction
    useTooltip: DiscordModules.Components.UseTooltipFunction

    TextStyleSheet: DiscordModules.Components.Styles.TextStyleSheet

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
    FloatingActionButton: DiscordModules.Components.FloatingActionButton
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
