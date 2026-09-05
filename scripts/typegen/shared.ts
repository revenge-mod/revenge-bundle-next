import { tmpdir } from 'os'
import { join } from 'path'

export const TypesPackageScope = 'revenge-mod'

export const TypesPackageName = `@${TypesPackageScope}/types`

export const TypesPackageDependencies = ['buffer']

export const TypesPackagePeerDependencies = [
    '@react-navigation/core',
    '@react-navigation/native',
    '@react-navigation/stack',
    '@shopify/flash-list',
    '@types/node',
    'react',
    'react-native',
    'react-native-gesture-handler',
    'react-native-reanimated',
    'react-native-safe-area-context',
]

export const TypesPackageOptionalPeerDependencies = [
    '@react-navigation/core',
    '@react-navigation/native',
    '@react-navigation/stack',
    '@shopify/flash-list',
    '@types/node',
    'react-native-safe-area-context',
]

export const Paths = {
    /** Workspace libraries directory and entry name prefix. */
    lib: 'lib',
    consumerGlobals: join('types', 'globals.consumers.ts'),
    output: join('dist', 'types'),
    outputTemp: join('dist', 'types', 'tmp'),
    tsconfig: 'tsconfig.json',
    verify: join(tmpdir(), 'revenge-types-verify'),
} as const

export const Exports = {
    types: 'index.d.ts',
    globals: 'globals.d.ts',
    importMap: 'modules.importmap.json',
    hiddenTypes: 'hidden.d.ts',
    hiddenImportMap: 'modules.hidden.importmap.json',
    manifest: 'package.json',
} as const

/** Root object definition and visibility tier. */
export interface ApiRoot {
    /** Dotted path recorded in import map. */
    name: string
    /** Access expression for type checking. */
    access: string
    /** Module visibility status. */
    hidden: boolean
}

export const PublicApi: ApiRoot = {
    name: 'revenge',
    access: 'revenge',
    hidden: false,
}

/** Internal APIs exposed only when Developer Mode is enabled. */
export const HiddenApi: ApiRoot = {
    name: 'revenge.hidden',
    access: 'revenge.hidden!',
    hidden: true,
}

export type TrimLeadingDot<T extends string> = T extends `.${infer R}`
    ? R extends `/${infer S}`
        ? S
        : R
    : T

/** Relationship between module export and global value. */
export type ExportInterop = 'default'

/** Sentinel for export binding without global mapping. */
export const NoGlobal = Symbol('no global')
export type NoGlobal = typeof NoGlobal

/**
 * Library export binding definition.
 *
 * Tuple form: `[name, global, interop?]` maps module to `<root>.<global>`.
 * Object form: `{ from, into, global }` merges export into target module.
 */
export type ExportBinding<T extends string> =
    | [name: T, global: string | NoGlobal, interop?: ExportInterop]
    | { from: T; into: string; global: string }

/** Normalized export binding descriptor. */
export interface NormalizedBinding {
    /** Subpath in library package.json exports, empty for root. */
    name: string
    /** Target module name when merging multiple exports. */
    into?: string
    global?: string
    interop?: ExportInterop
}

/** Source file descriptor for merged module. */
export interface MergeSource {
    name: string
    path: string
    global?: string
}

/** Entrypoint emitted as declaration chunk. */
export interface GeneratedEntry {
    /** Rolldown entry name, e.g. `lib/modules/metro`. */
    entry: string
    /** Source file path. */
    path: string
    /** Output declaration path relative to destination directory. */
    declaration: string
}

/** Identifier mappings for generated module. */
export interface ModuleNames {
    /** Public module subpath, e.g. `modules/metro`. */
    name: string
    /** Public import specifier, e.g. `@revenge-mod/modules/metro`. */
    specifier: string
    /** Package-private specifier used in declarations, e.g. `#lib/modules/metro`. */
    internalSpecifier: string
}

/** Generated module definition. */
export interface LibraryModule extends GeneratedEntry, ModuleNames {
    /** Pre-generated source code for synthetic merged modules. */
    source?: string
    /** Target API root. */
    root: ApiRoot
    /** Dotted property path within root. Omitted for type-only modules. */
    global?: string
    interop?: ExportInterop
}

/** Import map entry. */
export interface ImportMapModule {
    specifier: string
    /** Dotted property path within root. */
    global: string
    interop?: ExportInterop
}

/** Import map manifest. */
export interface ImportMap {
    file: string
    root: ApiRoot
    modules: ImportMapModule[]
}

/** Serialized import map value. */
export type ImportMapEntry = string | { global: string; interop: ExportInterop }
