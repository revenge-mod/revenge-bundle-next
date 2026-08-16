import type { AnyFunction } from '@revenge-mod/utils/types'

/** Every JS method native can call, keyed by the name it was registered under. */
// Moved to here to expose to hidden API
export const ExposedJSMethods: {
    [methodName: string]: AnyFunction
} = {}
