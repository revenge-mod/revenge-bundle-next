import type { Metro } from '../../types'
import type { ModuleFirstRequiredCallback, ModuleInitializedCallback } from '.'

export const sRequireAny = new Set<ModuleFirstRequiredCallback>()
export const sRequire = new Map<
    Metro.ModuleID,
    Set<ModuleFirstRequiredCallback>
>()
export const sInitializeAny = new Set<ModuleInitializedCallback>()
export const sInitialize = new Map<
    Metro.ModuleID,
    Set<ModuleInitializedCallback>
>()

export function executeRequireSubscriptions(id: Metro.ModuleID) {
    for (const cb of sRequireAny)
        try {
            cb(id)
        } catch {}

    if (sRequire.has(id)) {
        for (const cb of sRequire.get(id)!)
            try {
                cb(id)
            } catch {}

        sRequire.delete(id)
    }
}

export function executeInitializeSubscriptions(
    id: Metro.ModuleID,
    exports: Metro.ModuleExports,
) {
    for (const cb of sInitializeAny)
        try {
            cb(id, exports)
        } catch {}

    if (sInitialize.has(id)) {
        for (const cb of sInitialize.get(id)!)
            try {
                cb(id, exports)
            } catch {}

        sInitialize.delete(id)
    }
}
