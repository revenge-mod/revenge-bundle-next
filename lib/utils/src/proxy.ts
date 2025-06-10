/**
 * This patch allows us to store instances of Proxy, so we can check whether a value is created using Proxy or not.
 * This is especially useful for blacklisting exports that cannot be patched.
 */

const _targets = new WeakMap<object, object>()

const OriginalProxy = globalThis.Proxy
globalThis.Proxy = new Proxy(OriginalProxy, {
    construct(_target, args) {
        const prox = new OriginalProxy(args[0], args[1])
        _targets.set(prox, args[0])
        return prox
    },
})

/**
 * Returns whether the object is a proxy.
 *
 * @param obj The object to check
 */
export function isProxy(obj: object) {
    return _targets.has(obj)
}

/**
 * Returns whether the object is a proxified value.
 *
 * @param obj The object to check
 */
export function isProxified(obj: object) {
    return _metas.has(obj)
}

/**
 * Returns the target of the proxy.
 *
 * @param obj The proxy
 * @returns The target of the proxy
 */
export function getProxyTarget(obj: object) {
    return _targets.get(obj)
}

// Heavily inspired by Wintry's lazy utils, but more optimized and stripped down, with a few fixes.
// https://github.com/pylixonly/wintry/blob/main/src/utils/lazy.ts

const _metas = new WeakMap<
    object,
    [factory: () => unknown, bind: boolean, cacheable: boolean, cache?: unknown]
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

        if (typeof val === 'function' && _metas.get(hint)![1])
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
     * @default 'function'
     */
    hint?: 'object' | 'function' | object
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
 * const proxified = proxify(() => ({ value: Math.random() }), { hint: 'object' })
 * console.log(proxified) // { value: 0.123 }
 * console.log(proxified.value) // 0.456
 * console.log(proxified) // { value: 0.789 }
 * ```
 *
 * @example With cache
 * ```ts
 * const proxified = proxify(() => ({ value: Math.random() }), { hint: 'object', cache: true })
 * console.log(proxified) // { value: 0.123 }
 * console.log(proxified.value) // 0.123
 * console.log(proxified) // { value: 0.123 }
 * ```
 */
export function proxify<T>(signal: () => T, options?: ProxifyOptions): T {
    let hint: any

    switch (options?.hint) {
        case undefined:
        case 'function':
            // biome-ignore lint/complexity/useArrowFunction: We need a function with a constructor
            hint = function () {}
            break
        case 'object':
            hint = {}
            break
        default:
            hint = options!.hint
            break
    }

    _metas.set(hint, [
        signal,
        options?.bindMethods ?? false,
        options?.cache ?? false,
    ])
    return new Proxy(hint, _handler)
}

/**
 * Get the value of a proxified value at the current moment.
 *
 * @see {@link proxify} for more documentation.
 *
 * @param proxified The proxified value.
 * @returns The unproxified value.
 *
 * @throws {TypeError} If the value is not a proxified value.
 *
 * @example Without cache
 * ```ts
 * const proxified = proxify(() => ({ value: Math.random() }), { hint: 'object' })
 * const x = unproxify(proxified)
 * console.log(x) // { value: 0.123 }
 * console.log(x.value) // 0.123
 * console.log(proxified) // { value: 0.456 }
 * ```
 *
 * @example With cache
 * ```ts
 * const proxified = proxify(() => ({ value: Math.random() }), { hint: 'object', cache: true })
 * const x = unproxify(proxified)
 * console.log(x) // { value: 0.123 }
 * console.log(x.value) // 0.123
 * console.log(proxified) // { value: 0.123 }
 * ```
 */
export function unproxify<T extends object>(proxified: T): T {
    const hint = getProxyTarget(proxified)
    if (!hint)
        throw new TypeError(`${typeof proxified} is not a proxified value`)
    return unproxifyFromHint(hint)
}

function unproxifyFromHint(hint: object) {
    const meta = _metas.get(hint)!
    if (meta[1]) return meta[2] ?? ((meta[3] = meta[0]()) as any)
    return meta[0]() as any
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
 *   { hint: 'object' }
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
export function destructure<T extends object>(
    proxified: T,
    options?: ProxifyOptions,
): T {
    return new Proxy({} as T, {
        get: (_, p) =>
            proxify(() => {
                // @ts-expect-error
                const v = unproxify(proxified)[p]

                if (v == null)
                    throw new TypeError(
                        `Cannot destructure and proxify ${v} (reading '${String(p)}')`,
                    )
                if (typeof v === 'function' || typeof v === 'object') return v
                throw new TypeError(
                    `Cannot destructure and proxify a primitive (reading '${String(p)}')`,
                )
            }, options),
    })
}
