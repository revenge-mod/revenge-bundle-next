import type { DiscordModules } from '.'

declare module '@revenge-mod/plugins/types' {
    export interface InitPluginApi<O extends PluginApiExtensionsOptions> {
        logger: DiscordModules.Logger
    }
}
