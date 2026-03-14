import { lookupModule, lookupModules } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { getModuleDependencies } from '@revenge-mod/modules/metro/utils'
import {
    ReactJSXRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'
import { ImportTrackerModuleId } from './common'
import type { DiscordModules } from './types'

const { loose } = withDependencies

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
    // TODO: Possibly come up with a better dependency fingerprinting API
    // to not have to deal with this bullshit

    for (const [, id] of lookupModules(
        withDependencies(
            loose([
                null,
                ReactModuleId,
                ReactNativeModuleId,
                ReactJSXRuntimeModuleId,
            ]),
        ).keyAs('revenge.discord.design.FormSwitch'),
        {
            initialize: false,
        },
    )) {
        const deps = getModuleDependencies(id)!
        console.log(id, deps.at(-4), deps.at(-5))
        if (deps.at(-1) !== ImportTrackerModuleId) continue

        if (
            // TODO: Remove once stable > 321203
            (deps.at(-2) === id + 2 && deps.at(-3) === id + 1) ||
            // 321203+
            (deps.at(-4) === id + 2 && deps.at(-5) === id + 1)
        ) {
            const FormSwitch_ = __r(id)!.FormSwitch
            if (FormSwitch_) return (FormSwitch = FormSwitch_)
        }
    }
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
