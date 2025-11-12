import { callNativeMethod } from '@revenge-mod/modules/native'
import { getErrorStack } from '@revenge-mod/utils/error'
import { BuildEnvironment, FullVersion } from '~constants'
import type { Metro } from '@revenge-mod/modules/types'

// @ts-expect-error
globalThis.ErrorUtils = {
    // RN JSI only requires these two properties:
    // https://github.com/facebook/react-native/blob/802e1a7/packages/react-native/ReactCommon/cxxreact/ErrorUtils.h#L18-L19
    reportError: onError,
    reportFatalError: onError,
}

Object.defineProperty(globalThis, '__c', {
    configurable: true,
    set(clear: Metro.ClearFn) {
        // @ts-expect-error
        // biome-ignore lint/performance/noDelete: Prevent infinite set loop
        delete globalThis.__c
        globalThis.__c = clear

        // @as-require
        import('./preinit')
    },
})

export function onError(error: unknown) {
    const stack = getErrorStack(error)

    callNativeMethod('revenge.alertError', [
        stack,
        `${FullVersion} (${BuildEnvironment})`,
    ])

    nativeLoggingHook(`\u001b[31m${stack}\u001b[0m`, 2)
}

declare module '@revenge-mod/modules/native' {
    export interface Methods {
        'revenge.alertError': [[error: string, version: string], void]
    }
}
