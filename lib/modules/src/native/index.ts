import { getCurrentStack, getErrorStack } from '@revenge-mod/utils/error'

const turboModuleProxy = globalThis.__turboModuleProxy

/**
 * Backwards compatible way to get a native module. Throws an error if the module is not found.
 *
 * Use this as a replacement to `TurboModuleRegistry.getEnforcing()`.
 *
 * @see {@link https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/TurboModule/TurboModuleRegistry.js#L19-L39 React Native's source}
 *
 * @param name The name of the native module to get.
 */
export function getNativeModule<T>(name: string): T | null {
    const module =
        // Non-bridgeless with TurboModules
        turboModuleProxy?.(name) ??
        // Bridgeless & legacy modules
        nativeModuleProxy[name]

    if (module) return module as T

    throw new Error(`Unable to access native module: ${name}`)
}

const Bridge = getNativeModule<{
    getBBox(handle: number, options: object): object
}>('RNSVGRenderableModule')!

const BridgePromise = getNativeModule<{
    readAsDataURL(map: object): Promise<any>
}>('FileReaderModule')!

function makePayload(name: string, args: any[]): object {
    return {
        revenge: {
            method: name,
            args: args,
        },
    }
}

/**
 * Calls a method on the native module and returns a promise that resolves with the result.
 *
 * @param name The name of the native method to call.
 * @param args The arguments to pass to the native method.
 * @returns A promise that resolves with the result of the native method call.
 */
export async function callNativeMethod<N extends MethodName>(
    name: N,
    args: MethodArgs<N>,
): Promise<MethodResult<N>> {
    try {
        const result = await BridgePromise.readAsDataURL(
            makePayload(name, args),
        )

        if ('error' in result) throw result.error
        if ('result' in result) return result.result as MethodResult<N>

        throw 'The module did not return a valid result. The native hook must have failed.'
    } catch (error) {
        throw new Error(`Call failed: ${error}`)
    }
}

/**
 * Calls a method on the native module synchronously and returns the result.
 *
 * Only use synchronous methods when absolutely necessary, as they block JS execution until the native method returns.
 *
 * @param name The name of the native method to call.
 * @param args The arguments to pass to the native method.
 * @returns The result of the native method call.
 */
export function callNativeMethodSync<N extends MethodName>(
    name: N,
    args: MethodArgs<N>,
): MethodResult<N> {
    try {
        const result = Bridge.getBBox(0, makePayload(name, args))

        if ('error' in result) throw result.error
        if ('result' in result) return result.result as MethodResult<N>

        throw 'The module did not return a valid result. The native hook must have failed.'
    } catch (error) {
        throw new Error(`Call failed: ${error}`)
    }
}

/**
 * Get the bridge information.
 */
export function getBridgeInfo(): BridgeInfo | null {
    try {
        return callNativeMethodSync('revenge.info', [])
    } catch (e) {
        nativeLoggingHook(
            `\u001b[31mFailed to get native bridge info: ${e}\u001b[0m`,
            2,
        )
        return null
    }
}

type AnyFunction = (...args: any[]) => any

const CallableReturnNativeMethodName = 'revenge.__callableReturn' as const
const CallableModuleName = 'RevengeBridge'
const ExposedJSMethods: {
    [methodName: string]: AnyFunction
} = {}

/**
 * Registers a JS method that can be called from native code.
 *
 * @param name The name of the method to register.
 * @param method The method implementation.
 */
export function registerJSMethod(name: string, method: AnyFunction) {
    if (__DEV__ && ExposedJSMethods[name])
        nativeLoggingHook(
            `\u001b[33mWarning: Overwriting existing registered JS method: ${name}\n${getCurrentStack()}\u001b[0m`,
            1,
        )

    ExposedJSMethods[name] = _wrapJSMethod(method)
}

function _wrapJSMethod(method: AnyFunction) {
    return (...args: any[]) => {
        try {
            const ret = method(...args)
            if (ret instanceof Promise)
                ret.then(
                    result => _returnJSCall({ result: result ?? null }),
                    error => _returnJSCall({ error: getErrorStack(error) }),
                )
            else _returnJSCall({ result: ret ?? null })
        } catch (error) {
            _returnJSCall({ error: getErrorStack(error) })
        }
    }
}

function _returnJSCall(payload: object) {
    callNativeMethodSync(CallableReturnNativeMethodName, [payload])
}

RN$registerCallableModule(
    CallableModuleName,
    () =>
        new Proxy(ExposedJSMethods, {
            get(target, prop: string) {
                const method = target[prop]
                if (!method)
                    return () => {
                        // Can't catch this native side, this will crash the app
                        throw new Error(`JS method not found: ${prop}`)
                    }
                return method
            },
        }),
)

export interface BridgeInfo {
    name: string
    version: number
}

export type MethodName = Extract<keyof NativeMethods, string>
export type MethodArgs<T extends MethodName> = NativeMethods[T][0]
export type MethodResult<T extends MethodName> = NativeMethods[T][1]

export interface NativeMethods {
    'revenge.info': [[], BridgeInfo]
    [CallableReturnNativeMethodName]: [[payload: object], void]
}
