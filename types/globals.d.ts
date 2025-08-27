import type { Metro } from '@revenge-mod/modules/types'
import type {
    ImageProps,
    ScrollViewProps,
    TextProps,
    ViewProps,
} from 'react-native'

/// REACT NATIVE COMPONENTS

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            // TODO(PalmDevs): more intrinsic elements?
            RCTView: ViewProps
            RCTImage: ImageProps
            RCTScrollView: ScrollViewProps
            RCTText: TextProps
        }
    }
}

/// HERMES

declare global {
    const HermesInternal: HermesInternalObject

    function setTimeout(
        cb: (...args: unknown[]) => unknown,
        timeout?: number,
    ): number
    /**
     * Calls the garbage collector
     */
    function gc(): void

    interface HermesInternalObject {
        getRuntimeProperties(): Record<string, string>
        // biome-ignore lint/complexity/noBannedTypes: You can pass any function here
        getFunctionLocation(fn: Function): {
            fileName: string
            lineNumber: number
            columnNumber: number
            segmentID: number
            virtualOffset: number
            isNative: boolean
        }
    }
}

/// HERMES PROMISES

declare global {
    // biome-ignore lint/correctness/noUnusedVariables: Type parameter names must match
    interface Promise<T> {
        /// PROMISE POLYFILLS FROM: https://github.com/then/promise
        /// AND: https://github.com/facebook/hermes/blob/main/lib/InternalBytecode/01-Promise.js
        _h: 0 | 1 | 2
        /**
         * The resolved value of the promise, if it has been resolved.
         */
        _j: any
    }

    type HermesPromiseRejectionHandler = (
        promise: Promise<any>,
        error: any,
    ) => void

    interface PromiseConstructor {
        _m: HermesPromiseRejectionHandler
    }
}

/// REACT DEVTOOLS

declare global {
    var __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown | undefined
    var __REACT_DEVTOOLS__:
        | {
              version: number
              exports: {
                  connectToDevTools(opts: {
                      host?: string
                      port?: number
                      websocket?: WebSocket
                  }): void
              }
          }
        | undefined
}

/// METRO

declare global {
    var __METRO_GLOBAL_PREFIX__: ''

    var __d: Metro.DefineFn
    var __r: Metro.RequireFn & {
        importDefault: Metro.ImportDefaultFn
        importAll: Metro.ImportAllFn
    }
    var __c: Metro.ClearFn
}

/// REACT NATIVE

declare global {
    var nativeModuleProxy: Record<string, unknown>
    var __turboModuleProxy: ((name: string) => unknown) | undefined
    function nativeLoggingHook(str: string, level: number): void
    function alert(message: unknown): void
    function queueMicrotask(cb: () => void): void

    var nativePerformanceNow: typeof performance.now
    var performance: {
        now(): number
    }
}
