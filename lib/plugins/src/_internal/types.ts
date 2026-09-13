import type {
    Plugin,
    PluginCleanup,
    PluginManifest,
    PluginOptions,
    PluginOptionsFactory,
} from '../types'
import type { PluginSystemErrorPayload } from './errors'

export type AnyPlugin = Plugin<any, any>

export type InternalPluginManifest = Omit<
    PluginManifest,
    'version' | 'format' | 'dependencies'
> &
    Partial<Pick<PluginManifest, 'version' | 'format' | 'dependencies'>>

export interface InternalPluginMeta {
    /** Handles critical errors during plugin execution. */
    handleError: (e: unknown) => Promise<void>
    promises: Promise<void>[]
    cleanups: PluginCleanup[]
    iflags: number
    apiLevel: number
    /** Installed optional dependencies that are unsatisfied, from native. */
    unsatisfiedOptionalDependencies: readonly string[]
    options: PluginOptions<any>
    optionsFactory?: PluginOptionsFactory<any>
    status: number
    flags: number
    nativeErrors: readonly PluginSystemErrorPayload[]
    /** Plugin provenance. `repo: null` or missing indicates sideloaded plugin. Internal plugins don't have this field. */
    source?: PluginSource | null
}

export interface PluginSource {
    repo: string | null
    channel: string
    /** Update hold flag. Affects dependency resolution. */
    held: boolean
}

/** Staged and validated sideload plugin awaiting user confirmation. */
export interface PluginInstallReadyEvent {
    /** Single-use confirmation token. */
    token: string
    manifest: {
        id: string
        name: string
        description: string
        author: string
        version: string
        icon?: string | null
    }
    /** Installed version this replaces, or null for a fresh install. */
    replaces: string | null
}

export type PluginInstallEvent =
    | {
          error: false
          manifest: PluginManifest
          updated: boolean
          pending: false
      }
    | {
          /**
           * Plugin applied on disk only. Running version untouched until next reload.
           */
          error: false
          pending: true
          id: string
          version: string
      }
    | { error: PluginSystemErrorPayload }

/** Unsatisfied dependency reported by native when enabling is refused. */
export interface DependencyProblem {
    id: PluginManifest['id']
    /** Declared range (`*` for any). */
    required: string
    /** Installed version, or `null` when missing. */
    installed: string | null
    enabled: boolean
}

export interface PluginStateObject {
    enabled?: boolean
    pendingReload?: boolean
    startedLate?: boolean
    requiredByUser?: boolean
}

/** Flags of every loaded slot, keyed by slot ID then plugin ID. */
export interface PluginSlotStates {
    [slot: string]: {
        [id: PluginManifest['id']]: PluginStateObject
    }
}
