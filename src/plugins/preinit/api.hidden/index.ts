import { hiddenApi } from '@revenge-mod/hidden'
import { registerInternalPlugin } from '@revenge-mod/plugins/_'
import manifest from './manifest.json'

const pluginHiddenApi = registerInternalPlugin(manifest, {
    preInit({ cleanup, unscoped }) {
        unscoped.hidden = hiddenApi

        cleanup(() => {
            // biome-ignore lint/performance/noDelete: We want to remove the API completely
            delete unscoped.hidden
        })
    },
})

export default pluginHiddenApi
