/** Error payload shared by native method failures, boot errors, and install events. */
export interface PluginSystemErrorPayload {
    /** Error code identifier from {@link PluginErrorCodes} or arbitrary string. */
    code: string
    message: string
    stack?: string | null
    details?: Record<string, unknown>
}

export const PluginErrorCodes = {
    // Boot discovery
    ManifestInvalid: 'MANIFEST_INVALID',
    DependencyMissing: 'DEPENDENCY_MISSING',
    DependencyUnsatisfied: 'DEPENDENCY_UNSATISFIED',
    DependencyFailed: 'DEPENDENCY_FAILED',
    DependencyCycle: 'DEPENDENCY_CYCLE',
    LoadFailed: 'LOAD_FAILED',

    /* Plugin threw */
    PluginError: 'PLUGIN_ERROR',

    InstallInvalidZip: 'INSTALL_INVALID_ZIP',
    InstallVerifyFailed: 'INSTALL_VERIFY_FAILED',
    InstallMismatch: 'INSTALL_MISMATCH',
    InstallFailed: 'INSTALL_FAILED',

    // Method call fails
    InvalidArgument: 'INVALID_ARGUMENT',
    NotFound: 'NOT_FOUND',
    NotAllowed: 'NOT_ALLOWED',
    DependenciesUnsatisfied: 'DEPENDENCIES_UNSATISFIED',
    ResolveFailed: 'RESOLVE_FAILED',
    StorageFailed: 'STORAGE_FAILED',
    Unknown: 'UNKNOWN',
} as const

export function isPluginSystemErrorPayload(
    e: unknown,
): e is PluginSystemErrorPayload {
    return (
        typeof e === 'object' &&
        e !== null &&
        typeof (e as PluginSystemErrorPayload).code === 'string' &&
        typeof (e as PluginSystemErrorPayload).message === 'string'
    )
}

export function toPluginSystemErrorPayload(
    e: unknown,
): PluginSystemErrorPayload {
    if (isPluginSystemErrorPayload(e)) return e
    if (e instanceof Error)
        return {
            code: PluginErrorCodes.PluginError,
            message: e.message,
            stack: e.stack,
        }
    return { code: PluginErrorCodes.PluginError, message: String(e) }
}

export function formatPluginSystemErrorPayload(e: unknown): string {
    const err = toPluginSystemErrorPayload(e)
    return `[${err.code}] ${err.message}${err.stack ? `\n${err.stack}` : ''}`
}

/** Throwable carrying error code alongside message. */
export class PluginError extends Error implements PluginSystemErrorPayload {
    code: string
    details?: Record<string, unknown>

    constructor(error: PluginSystemErrorPayload) {
        super(error.message)
        this.name = 'PluginError'
        this.code = error.code
        if (error.stack) this.stack = error.stack
        this.details = error.details
    }
}

/** Plugin system native method failure. Thrown by `callPluginSystemMethod`. */
export class PluginSystemError extends PluginError {
    constructor(error: PluginSystemErrorPayload) {
        super(error)
        this.name = 'PluginSystemError'
    }
}
