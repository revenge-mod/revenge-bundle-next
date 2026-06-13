import {
    onSettingsModulesLoaded,
    refreshSettingsNavigator,
    refreshSettingsOverviewScreen,
} from '@revenge-mod/discord/modules/settings'
import { InternalPluginFlags, registerPlugin } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import pluginSettings from '../settings'
import * as dt from './devtools'
import defer * as rdt from './react-devtools'
import defer * as utils from './utils'
import type { PluginApi } from '@revenge-mod/plugins/types'

interface Storage {
    devTools: DevToolsSettings & { alias?: string }
    reactDevTools: DevToolsSettings
}

interface DevToolsSettings {
    address: string
    autoConnect: boolean
}

const defaultStorage: Storage = {
    devTools: {
        address: 'localhost:7864',
        autoConnect: false,
    },
    reactDevTools: {
        address: 'localhost:8097',
        autoConnect: false,
    },
}

// TODO(PalmDevs): only register in development builds once updates can be made automatic
registerPlugin<{ storage: Storage }>(
    {
        id: 'revenge.developer-kit',
        name: 'Developer Kit',
        description: 'Tools assisting Revenge developers.',
        author: 'Revenge',
        icon: 'WrenchIcon',
        dependencies: [pluginSettings],
    },
    {
        storage: {
            load: true,
            default: defaultStorage,
        },
        async start(api_) {
            api = api_

            onSettingsModulesLoaded(utils.register)

            if (api_.plugin.flags & PluginFlags.EnabledLate) {
                refreshSettingsOverviewScreen()
                refreshSettingsNavigator()
            }

            const settings = await api.storage.get()

            dt.DTContext.addr = settings.devTools.address
            dt.DTContext.alias = settings.devTools.alias ?? ''
            rdt.RDTContext.addr = settings.reactDevTools.address

            if (settings.devTools.autoConnect) dt.connect()
            if (settings.reactDevTools.autoConnect) rdt.connect()
        },
        stop({ cleanup }) {
            cleanup(refreshSettingsOverviewScreen, refreshSettingsNavigator)
        },
    },
    PluginFlags.Enabled,
    InternalPluginFlags.Internal,
)

// Expose to EvalJSSetting
export let api: PluginApi<{ storage: Storage }>
