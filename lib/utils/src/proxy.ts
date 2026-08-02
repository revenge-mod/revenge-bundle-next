/**
 * This patch allows us to store instances of Proxy, so we can check whether a value is created using Proxy or not.
 * This is especially useful for blacklisting exports that cannot be patched.
 */

import { asap } from './callback'
import { getCurrentStack } from './error'

/**
 * Returns whether the object is a proxified value.
 *
 * @param obj The object to check
 */
export function isProxified(obj: object) {
    return pMetadata.has(obj)
}

// Heavily inspired by Wintry's lazy utils, but more optimized and stripped down, with a few fixes.
// https://github.com/pylixonly/wintry/blob/main/src/utils/lazy.ts

const pMetadata = new WeakMap<
    object,
    {
        factory: () => unknown
        hint: object
        bind: boolean
        cacheable: boolean
        cache?: unknown
    }
>()

const _handler = {
    ...Object.fromEntries(
        Object.getOwnPropertyNames(Reflect).map(k => [
            k,
            (hint: object, ...args: any[]) =>
                // @ts-expect-error
                Reflect[k](unproxifyFromHint(hint), ...args),
        ]),
    ),
    // Workaround to fix functions that need the correct `this`
    get: (hint, p, recv) => {
        const target = unproxifyFromHint(hint)
        const val = Reflect.get(target!, p, recv)

        if (pMetadata.get(hint)?.bind && typeof val === 'function')
            return new Proxy(val, {
                // If thisArg happens to be a proxified value, we will use the target object instead
                apply: (fn, thisArg, args) =>
                    Reflect.apply(
                        fn,
                        thisArg === recv ? target : thisArg,
                        args,
                    ),
            })

        return val
    },
    // Workaround to fix:
    // TypeError: getOwnPropertyDescriptor trap result is not configurable but target property '...' is configurable or non-existent
    getOwnPropertyDescriptor: (hint, p) => {
        const d = Reflect.getOwnPropertyDescriptor(unproxifyFromHint(hint)!, p)
        if (d && !Reflect.getOwnPropertyDescriptor(hint, p))
            Object.defineProperty(hint, p, d)
        return d
    },
} as ProxyHandler<object>

export interface ProxifyOptions {
    /**
     * The hint for the proxified value.
     *
     * @default function () {}
     */
    hint?: object
    /**
     * Whether the proxified value should be cached.
     */
    cache?: boolean
    /**
     * For methods of the proxified value, whether to bind the `this` context to the proxified value.
     * The original reference of this method will NOT be retained. To get the original method, use `getProxyTarget` on the method.
     *
     * @default false
     */
    bindMethods?: boolean
}

/**
 * Proxify a value.
 *
 * @param signal The signal to use to get the value.
 * @param options The options to use for the proxified value.
 * @returns A proxified value that will be updated when the signal is updated.
 *
 * @example Without cache
 * ```ts
 * const proxified = proxify(() => ({ value: Math.random() }), { hint: {} })
 * console.log(proxified) // { value: 0.123 }
 * console.log(proxified.value) // 0.456
 * console.log(proxified) // { value: 0.789 }
 * ```
 *
 * @example With cache
 * ```ts
 * const proxified = proxify(() => ({ value: Math.random() }), { hint: {}, cache: true })
 * console.log(proxified) // { value: 0.123 }
 * console.log(proxified.value) // 0.123
 * console.log(proxified) // { value: 0.123 }
 * ```
 */
export function proxify<T>(signal: () => T, options?: ProxifyOptions): T {
    // biome-ignore lint/complexity/useArrowFunction: We need a function with a constructor
    const hint = options?.hint ?? function () {}

    if (__BUILD_FLAG_DEBUG_LAZY_VALUES__)
        // Prevent race conditions where proxified values with a self modifying signal gets called,
        // modifying the original value to a non-proxified value, causing subsequent destructure() calls to fail

        asap(() => {
            if (unproxifyFromHint(hint) == null)
                DEBUG_warnNullishProxifiedValue()
        })

    const prox = new Proxy(hint, _handler) as T

    pMetadata.set(hint, {
        hint: hint,
        factory: signal,
        bind: options?.bindMethods ?? false,
        cacheable: options?.cache ?? false,
    })

    return prox
}

/**
 * Get the value of a proxified value at the current moment.
 * Returns the same value if not a proxified value.
 *
 * @see {@link proxify} for more documentation.
 *
 * @param proxified The proxified value.
 * @returns The unproxified value, or the value if it's not a proxified value.
 *
 * @example Without cache
 * ```ts
 * const proxified = proxify(() => ({ value: Math.random() }), { hint: {} })
 * const x = unproxify(proxified)
 * console.log(x) // { value: 0.123 }
 * console.log(x.value) // 0.123
 * console.log(proxified) // { value: 0.456 }
 * ```
 *
 * @example With cache
 * ```ts
 * const proxified = proxify(() => ({ value: Math.random() }), { hint: {}, cache: true })
 * const x = unproxify(proxified)
 * console.log(x) // { value: 0.123 }
 * console.log(x.value) // 0.123
 * console.log(proxified) // { value: 0.123 }
 * ```
 */
export function unproxify<T extends object>(proxified: T): T {
    const hint = pMetadata.get(proxified)?.hint
    if (!hint) return proxified
    return unproxifyFromHint(hint)
}

function unproxifyFromHint(hint: object) {
    const meta = pMetadata.get(hint)!
    if (meta.cacheable)
        return meta.cache ?? ((meta.cache = meta.factory()) as any)
    return meta.factory() as any
}

export type DestructureOptions<T extends object> = {
    [K in keyof T]?: ProxifyOptions
}

export type DestructureResult<T extends object> = {
    [K in keyof T]: T[K]
}

/**
 * Destructure a proxified value.
 *
 * @param proxified The proxified value.
 * @param options The options to use for the destructured value.
 *
 * @see {@link proxify} for more documentation.
 *
 * @throws {TypeError} If the value is not a proxifiable value (primitives).
 *
 * @example
 * ```ts
 * // cache is not turned on, so each access will call the signal again
 * const { x, y } = destructure(
 *   proxify(() => ({ x: Math.random(), y: [Math.random()], z: null })),
 *   // Optional: Specify ProxifyOptions for each property
 *   { y: { hint: [] } }
 * )
 *
 * // Non-nullish primitives are not proxifiable
 * x // TypeError: Cannot destructure and proxify a primitive (reading 'x')
 *
 * y // [0.123]
 * y // [0.456]
 *
 * z // TypeError: Cannot destructure and proxify null (reading 'z')
 * ```
 */
export function destructure<T extends object, O extends DestructureOptions<T>>(
    proxified: T,
    options?: O,
): DestructureResult<T> {
    return new Proxy({} as T, {
        get: (_, p, r) =>
            proxify(
                () => {
                    const v = Reflect.get(unproxify(proxified), p, r)

                    if (v == null)
                        throw new TypeError(
                            `Cannot destructure and proxify ${v} (reading '${String(p)}')`,
                        )
                    if (typeof v === 'function' || typeof v === 'object')
                        return v
                    throw new TypeError(
                        `Cannot destructure and proxify a primitive (reading '${String(p)}')`,
                    )
                },
                options?.[p as keyof T],
            ),
    }) as DestructureResult<T>
}

/**
 * Warns the developer that the proxified value is nullish.
 */
function DEBUG_warnNullishProxifiedValue() {
    nativeLoggingHook(
        `\u001b[33mProxified value is nullish! The signal is may be invalid.\n${getCurrentStack()}\u001b[0m`,
        3,
    )
}
