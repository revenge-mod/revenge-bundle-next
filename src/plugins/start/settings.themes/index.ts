import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { registerInternalPlugin } from '@revenge-mod/plugins/_'
import { updatePlugins } from '@revenge-mod/plugins/_/repositories'
import apiManifest from '../../preinit/api.themes/manifest.json'
import { messageOf } from '../settings.plugins/utils/strings'
import manifest from './manifest.json'

registerInternalPlugin(manifest, {
    start({ plugin }) {
        ToastActionCreators.open('REVENGE_THEMES_STUB_UPDATE', {
            text: 'Downloading and installing updates for Theme plugins...',
        })

        updatePlugins([manifest.id, apiManifest.id])
            .then(result => {
                if (!result.errors.length) return

                ToastActionCreators.open('REVENGE_THEMES_STUB_UPDATE_ERRORS', {
                    text: `Errors occurred while updating plugins: ${result.errors
                        .map(e => `${e.id}: ${messageOf(e.error)}`)
                        .join('\n')}`,
                    variant: 'critical',
                })

                for (const error of result.errors) {
                    plugin.reportError(
                        new Error(`Failed to update plugin ${error.id}`, {
                            cause: error.error,
                        }),
                    )
                }
            })
            .finally(() => {
                plugin.disable()
            })
    },
})
