import { TypedEventEmitter } from '@revenge-mod/discord/common/utils'
import type { PluginOptions } from '../types'
import type {
    AnyPlugin,
    PluginInstallEvent,
    PluginInstallReadyEvent,
} from './types'

export const pEmitter = new TypedEventEmitter<{
    register: [AnyPlugin, PluginOptions<any>, update?: true]
    unregister: [AnyPlugin]
    /** Flags changed. */
    stateUpdate: [AnyPlugin]
    /** Lifecycle status changed.*/
    statusUpdate: [AnyPlugin]
    /** Metadata changed that isn't a state or status change. */
    metadataUpdate: [AnyPlugin]
    install: [PluginInstallEvent]
    installReady: [PluginInstallReadyEvent]
}>()
