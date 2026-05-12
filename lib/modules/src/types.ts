import type { If } from '@revenge-mod/utils/types'

/**
 * Metro is a bundler for React Native.
 *
 * @see {@link https://github.com/facebook/metro/blob/main/packages/metro-runtime/src/polyfills/require.js}
 */
export namespace Metro {
    export type DependencyMap = Array<ModuleID>

    export type FactoryFn = (
        global: object,
        require: RequireFn,
        metroImportDefault: RequireFn,
        metroImportAll: RequireFn,
        moduleObject: Module,
        exports: ModuleExports,
        dependencyMap: DependencyMap,
    ) => void

    export type RegisterSegmentFn = (
        segmentId: number,
        moduleDefiner: (moduleId: ModuleID) => void,
        moduleIds?: ReadonlyArray<ModuleID> | null,
    ) => void

    export type ModuleID = number

    export interface ModuleDefinition<Initialized = boolean> {
        /**
         * Dependencies of this module (set to `undefined` once the module is initialized)
         */
        dependencyMap: If<Initialized, undefined, DependencyMap>
        /**
         * Error that occurred during initialization
         */
        error?: any
        /**
         * Factory function that initializes the module
         */
        factory: If<Initialized, undefined, FactoryFn>
        /**
         * Whether an error occurred during initialization
         */
        hasError: boolean
        importedAll: ModuleExports
        importedDefault: ModuleExports
        /**
         * Whether factory has been successfully called
         * */
        isInitialized: boolean
        publicModule: Module
    }

    export type Module = {
        id?: ModuleID
        exports: ModuleExports
    }

    export type ModuleList = Map<ModuleID, ModuleDefinition>

    export type RequireFn = (id: ModuleID) => ModuleExports

    export type DefineFn = (
        factory: FactoryFn,
        moduleId: ModuleID,
        dependencyMap: DependencyMap,
    ) => void

    export type ClearFn = () => ModuleList

    export interface Require extends RequireFn {
        importDefault: RequireFn
        importAll: RequireFn
    }

    export type ModuleExports = any
}

export namespace RevengeMetro {
    export type Module = {
        id: Metro.ModuleID
        exports: Metro.ModuleExports
    }

    export type ModuleDefinition<Initialized = boolean> = {
        flags: number
        module?: Module
        factory: If<Initialized, undefined, () => void>
        importedDefault?: Metro.ModuleExports
        importedAll?: Metro.ModuleExports
        error?: If<Initialized, undefined, any>
    }

    export type ModuleList = Map<Metro.ModuleID, ModuleDefinition>
}

/**
 * Maybe the default export matched instead of the namespace, because you're using `options.returnNamespace`.
 */
export type MaybeDefaultExportMatched<T> = T | { default: T }
