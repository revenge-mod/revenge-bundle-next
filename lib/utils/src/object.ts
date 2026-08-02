import { asap } from '@revenge-mod/utils/callback'
import { getCurrentStack } from './error'
import type { AnyObject } from './types'

/**
 * Simple check if to see if value is an object.
 *
 * @param val The value to check.
 */
export function isObject(val: any): val is AnyObject {
    return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/**
 * Clone an object deeply.
 *
 * @param source The source object to clone.
 */
export function cloneDeep<T>(source: T, cache = new WeakMap()): T {
    if (source === null || typeof source !== 'object') return source

    // Circular reference (use existing cloned object)
    if (cache.has(source)) return cache.get(source)

    const isArray = Array.isArray(source)
    const clone = (isArray ? [] : {}) as T
    cache.set(source, clone)

    if (isArray) {
        const sourceArray = source as any[]
        const cloneArray = clone as any[]
        for (let i = 0; i < sourceArray.length; i++)
            cloneArray[i] = cloneDeep(sourceArray[i], cache)
    } else {
        const sourceObj = source as AnyObject
        const cloneObj = clone as AnyObject

        const keys = Reflect.ownKeys(sourceObj)
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            cloneObj[key] = cloneDeep(sourceObj[key], cache)
        }
    }

    return clone
}

/**
 * Deep merge two objects.
 *
 * @param target The object to merge into.
 * @param source The object to merge from.
 *
 * @returns The merged target.
 */
export function mergeDeep(target: AnyObject, source: AnyObject) {
    if (isObject(target) && isObject(source))
        for (const [key, value] of Object.entries(source))
            if (isObject(value)) {
                if (!target[key]) Object.assign(target, { [key]: {} })
                mergeDeep(target[key], value)
            } else Object.assign(target, { [key]: value })

    return target
}

/**
 * Define a lazy property on an object that will be loaded when accessed.
 *
 * @param target The target object to define the property on.
 * @param property The property key to define.
 * @param loader The function that will be called to load the property value when accessed.
 * @return The target object with the lazy property defined.
 */
export function defineLazyProperty<T extends object, K extends keyof T>(
    target: T,
    property: K,
    loader: () => T[K],
) {
    return Object.defineProperty(
        target,
        property,
        lazyPropDesc<T, K>(property, loader),
    )
}

/**
 * Define multiple lazy properties on an object that will be loaded when accessed.
 *
 * @param target The target object to define the properties on.
 * @param loaders An object where each key is a property name and the value is a function that returns the property value when accessed.
 * @returns The target object with the lazy properties defined.
 */
export function defineLazyProperties<T extends object>(
    target: T,
    loaders: Partial<Record<keyof T, () => T[keyof T]>>,
) {
    const descs: PropertyDescriptorMap = {}

    for (const [key, loader] of Object.entries(loaders) as Array<
        [keyof T, (typeof loaders)[keyof T]]
    >)
        descs[key] = lazyPropDesc<T, keyof typeof loaders>(key, loader!)

    return Object.defineProperties(target, descs)
}

// Fake symbol to represent uninitialized values in lazy properties.
const UninitializedSymbol = {}

function lazyPropDesc<T extends object, K extends keyof T>(
    key: K,
    loader: () => T[K],
): PropertyDescriptor {
    if (__BUILD_FLAG_DEBUG_LAZY_VALUES__) {
        let val: unknown | typeof UninitializedSymbol = UninitializedSymbol
        const getOrLoadVal = () => {
            try {
                if (val === UninitializedSymbol) val = loader()
                return val
            } catch (error) {
                DEBUG_warnFaultyLazyLoader(key, error)
                val = null
            }
        }

        asap(() => {
            if (getOrLoadVal() == null) DEBUG_warnNullishLazyValue(key)
        })

        return {
            configurable: true,
            get: getOrLoadVal,
        }
    }

    return {
        configurable: true,
        get(this: T) {
            const val = loader()
            delete this[key]
            return (this[key] = val)
        },
    }
}

function DEBUG_warnNullishLazyValue(key: PropertyKey) {
    nativeLoggingHook(
        `\u001b[33mLazy property ${String(key)} is being initialized to a nullish value:\n${getCurrentStack()}\u001b[0m`,
        2,
    )
}

function DEBUG_warnFaultyLazyLoader(key: PropertyKey, error: unknown) {
    nativeLoggingHook(
        `\u001b[31mLazy property ${String(key)} threw an error during loading:\n${getCurrentStack()}\u001b[0m\nError: ${error}`,
        2,
    )
}
