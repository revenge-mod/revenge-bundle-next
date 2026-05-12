import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { api } from '..'
import { Setting } from '../constants'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const DTAutoConnectSetting: SettingsItem = {
    parent: Setting.RevengeDeveloper,
    IconComponent: () => <TableRowAssetIcon name="LinkIcon" />,
    useTitle: () => 'Auto-connect to DevTools',
    useDescription: () => 'Automatically connect to DevTools during startup.',
    useValue: () =>
        api.storage.use(s => s.devTools?.autoConnect !== undefined)!.devTools
            .autoConnect,
    onValueChange: v => {
        api.storage.set({ devTools: { autoConnect: v } })
    },
    type: 'toggle',
}

export default DTAutoConnectSetting
