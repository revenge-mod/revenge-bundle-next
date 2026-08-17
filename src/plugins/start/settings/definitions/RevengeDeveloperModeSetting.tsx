import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { ToastActionCreators } from '@revenge-mod/discord/actions'
import {
    disablePlugin,
    enablePlugin,
    isDefaultsOnlyBoot,
    isPluginEnabled,
    pEmitter,
    pList,
    runPluginLate,
} from '@revenge-mod/plugins/_'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { useReRender } from '@revenge-mod/utils/react'
import { useEffect } from 'react'
import pluginHiddenApi from '~plugins/preinit/api.hidden'
import { Setting } from '../constants'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

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
    useValue: useDeveloperModeEnabled,
    onValueChange: enabled => {
        const plugin = pList.get(pluginHiddenApi)
        if (!plugin) return

        if (enabled)
            enablePlugin(plugin)
                .then(() => runPluginLate(plugin))
                .catch(showFailureToast)
        else disablePlugin(plugin).catch(showFailureToast)
    },
}

function useDeveloperModeEnabled() {
    const plugin = pList.get(pluginHiddenApi)
    const reRender = useReRender()

    useEffect(() => {
        const handle = (changed: AnyPlugin) => {
            if (changed === plugin) reRender()
        }

        pEmitter.on('enabled', handle)
        pEmitter.on('disabled', handle)

        return () => {
            pEmitter.off('enabled', handle)
            pEmitter.off('disabled', handle)
        }
    }, [plugin, reRender])

    return plugin ? isPluginEnabled(plugin) : false
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
