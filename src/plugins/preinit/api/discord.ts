import { defineLazyProperty } from '@revenge-mod/utils/object'
import type { InitPluginApi } from '@revenge-mod/plugins/types'

export function init({
    decorate,
    unscoped: {
        discord: {
            common: {
                logger: { Logger },
            },
        },
    },
}: InitPluginApi) {
    decorate(plugin => {
        defineLazyProperty(
            plugin.api,
            'logger',
            () => new Logger(`Revenge > Plugins (${plugin.manifest.id})`),
        )
    })
}
