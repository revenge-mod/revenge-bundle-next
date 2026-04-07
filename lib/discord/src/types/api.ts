import type { DiscordModules } from '.'

declare module '@revenge-mod/plugins/types' {
    export interface InitPluginApi {
        logger: DiscordModules.Logger
    }
}
