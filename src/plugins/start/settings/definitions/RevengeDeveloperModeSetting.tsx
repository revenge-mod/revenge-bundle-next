import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { ToastActionCreators } from '@revenge-mod/discord/actions'
import {
    disablePlugin,
    enablePlugin,
    isDefaultsOnlyBoot,
    pList,
    runPluginLate,
} from '@revenge-mod/plugins/_'
import { usePluginEnabledById } from '@revenge-mod/plugins/_/react'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import pluginHiddenApi from '~plugins/preinit/api.hidden'
import { Setting } from '../constants'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const RevengeDeveloperModeSetting: SettingsItem = {
    parent: Setting.Revenge,
    type: 'toggle',
    IconComponent: () => <TableRowAssetIcon name="WrenchIcon" />,
    useTitle: () => 'Developer Mode',
    useDescription: () =>
        isDefaultsOnlyBoot
            ? 'Unavailable in Recovery Mode. Reload to exit.'
            : 'Exposes internal Revenge APIs for development purposes. Use with caution.',
    useIsDisabled: () => isDefaultsOnlyBoot,
    useValue: () => usePluginEnabledById(pluginHiddenApi),
    onValueChange: enabled => {
        const plugin = pList.get(pluginHiddenApi)
        if (!plugin) return

        if (enabled)
            enablePlugin(plugin, true)
                .then(() => runPluginLate(plugin))
                .catch(showFailureToast)
        else disablePlugin(plugin).catch(showFailureToast)
    },
}

function showFailureToast(e: unknown) {
    ToastActionCreators.open({
        key: 'REVENGE_DEVELOPER_MODE_FAILED',
        content: `Failed to toggle Developer Mode: ${e instanceof Error ? e.message : String(e)}`,
        IconComponent: lookupGeneratedIconComponent(
            'CircleXIcon',
            'CircleXIcon-primary',
            'CircleXIcon-secondary',
        )!,
    })
}

export default RevengeDeveloperModeSetting
