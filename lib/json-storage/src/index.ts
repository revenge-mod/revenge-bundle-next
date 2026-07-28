import {
    exists as fsExists,
    getConstants,
    readFile,
    rm,
    writeFile,
} from '@revenge-mod/modules/native/fs'
import { pluginStorageDirFor } from '@revenge-mod/plugins/constants'
import { getErrorStack } from '@revenge-mod/utils/error'
import { cloneDeep, mergeDeep } from '@revenge-mod/utils/object'
import type { AnyObject, DeepPartial, If } from '@revenge-mod/utils/types'

/**
 * Get the storage path for a plugin's JSON storage document.
 *
 * @param id The plugin ID.
 * @param file The file name (or relative path) of the storage document inside the plugin's storage directory.
 */
export const pluginStoragePathFor = (id: string, file = 'storage.json') =>
    `${pluginStorageDirFor(id)}/${file}`

export type JsonStorageSubscription<T extends AnyObject = AnyObject> = (
    update: DeepPartial<T>,
    mode: (typeof JsonStorageUpdateMode)[keyof typeof JsonStorageUpdateMode],
) => void

export const JsonStorageUpdateMode = {
    /**
     * The update will be merged into the existing storage.
     */
    Merge: 0,
    /**
     * The update will replace the existing storage.
     */
    Replace: 1,
    /**
     * Same behavior as {@link JsonStorageUpdateMode.Replace}, but for when the storage is being synced from disk.
     * E.g. on initial load, or when the storage file is deleted and recreated.
     */
    Load: 2,
} as const

/**
 * Create a new JSON storage object.
 *
 * @param path The path to the storage document.
 * - Relative paths resolve against the app data directory (`/data/data/<pkg>` on Android).
 *   Use `files/...` for app data or `cache/...` for cache on Android.
 * - Absolute paths are used as-is.
 *
 * @param options Options for the storage.
 */
export function JsonStorage<T extends AnyObject>(
    this: JsonStorage<T>,
    path: string,
    options?: JsonStorageOptions<T>,
) {
    const fullPath = path.startsWith('/')
        ? path
        : `${getConstants().data}/${path}`

    const subscriptions = new Set<JsonStorageSubscription<T>>()

    this.loaded = false

    this.exists = () => fsExists(fullPath)
    this.delete = async function () {
        await rm(fullPath)
        const success = !(await this.exists())
        if (this.loaded && success) await this.get()
        return success
    }

    this.subscribe = callback => {
        subscriptions.add(callback)
        return () => subscriptions.delete(callback)
    }

    async function write(storage: JsonStorage<T>) {
        try {
            const contents = JSON.stringify(storage.cache)
            await writeFile(fullPath, contents)
        } catch (e) {
            nativeLoggingHook(
                `Failed to write storage (${fullPath}): ${getErrorStack(e)}`,
                2,
            )
        }
    }

    this.get = async function () {
        if (!(await this.exists())) {
            this.cache = cloneDeep(options?.default ?? {})
            await write(this)
            this.loaded = true
            return this.cache
        }

        const contents = await readFile(fullPath)
        if (contents) {
            this.loaded = true
            try {
                const cache = (this.cache = JSON.parse(contents))
                for (const sub of subscriptions)
                    sub(cache, JsonStorageUpdateMode.Load)
                return cache
            } catch (e) {
                nativeLoggingHook(
                    `Failed to parse storage (${fullPath}): ${getErrorStack(e)}`,
                    2,
                )
            }
        }
    }

    this.set = async function (value: any, replace?: boolean) {
        if (!this.cache) await this.get()
        if (replace) this.cache = value as T
        else mergeDeep(this.cache as T, value as DeepPartial<T>)

        await write(this)

        for (const sub of subscriptions)
            sub(
                value,
                replace
                    ? JsonStorageUpdateMode.Replace
                    : JsonStorageUpdateMode.Merge,
            )
    }

    if (options?.load) this.get()
}

// React is only initialized right before the init stage, so this is a dummy method
// See init.ts in api.json-storage plugin for the actual implementation
JsonStorage.prototype.use = () => {
    throw new Error('JsonStorage#use can only be called after the init stage!')
}

/**
 * Get a JSON storage object for a given path.
 *
 * @param path The path to the storage document.
 * - Relative paths resolve against the app data directory (`/data/data/<pkg>` on Android).
 *   Use `files/...` for app data or `cache/...` for cache on Android.
 * - Absolute paths are used as-is.
 */
export function getJsonStorage<T extends AnyObject = AnyObject>(
    path: string,
    options?: JsonStorageOptions<T>,
): JsonStorage<T> {
    const storage: JsonStorage<T> = Object.create(JsonStorage.prototype)
    JsonStorage.call(storage, path, options)

    return storage
}

export interface JsonStorageOptions<T extends AnyObject = AnyObject> {
    /**
     * The default value to use for the storage. This will also be used for cache.
     *
     * @default {}
     */
    default?: T
    /**
     * Automatically load the storage after creating the instance.
     *
     * @default false
     */
    load?: boolean
}

export type UseJsonStorageFilter<T extends AnyObject = AnyObject> = (
    ...params: Parameters<JsonStorageSubscription<T>>
) => any

export interface JsonStorage<T extends AnyObject> {
    /**
     * Whether the storage has been loaded. If the storage is not loaded, `storage.cache` may be `undefined`.
     * If you have `options.default` set, you can use this property to check if `storage.cache` is the default value or not.
     */
    loaded: boolean
    /**
     * The cached storage object. Set once `get()` is called, and updated on `set()`.
     * You should not modify this directly.
     */
    cache?: T | AnyObject
    /**
     * Use the storage in a React component. The component will re-render when the storage is updated.
     *
     * This can only be used in the `init` stage or later, as it requires React to be initialized.
     *
     * @example
     * ```tsx
     * type Settings = { key: boolean, nested: { key: boolean } }
     *
     * const SettingsStorage = getJsonStorage<Settings>('settings.json')
     *
     * const MyComponent = () => {
     *   // Re-renders every time any of the keys in the settings object change
     *   const settings = SettingsStorage.use()
     *   // const settings: Settings | undefined
     *
     *   // ...
     * }
     *
     * const MyComponent2 = () => {
     *  // Re-renders every time the new value matches the filter
     *  const settings = SettingsStorage.use(val => val.key !== undefined)
     *  // const settings: Settings | undefined
     *
     *  // ...
     * }
     */
    use(filter?: UseJsonStorageFilter<T>): T | undefined
    /**
     * Subscribe to storage updates.
     *
     * @param callback The callback to call when the storage is updated.
     * @returns A function to unsubscribe.
     */
    subscribe(callback: JsonStorageSubscription<T>): () => void
    /**
     * Reads the storage from disk.
     * If the storage does not exist, it will be created with the default value.
     */
    get(): Promise<T>
    /**
     * Set the storage.
     *
     * @param value The value to merge into the storage.
     * @param replace If true, replaces the entire storage instead of merging.
     */
    set(value: DeepPartial<T>): Promise<void>
    set<Replace extends boolean>(
        value: If<Replace, T, DeepPartial<T>>,
        replace: Replace,
    ): Promise<void>
    /**
     * Whether the storage is exists.
     */
    exists(): Promise<boolean>
    /**
     * Delete the storage.
     */
    delete(): Promise<boolean>
}
