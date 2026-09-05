import { writeFile } from 'fs/promises'
import type {
    ApiRoot,
    ImportMap,
    ImportMapEntry,
    ImportMapModule,
    LibraryModule,
} from './shared'

/** Splits modules into public and hidden sets in emission order. */
export function partitionModules(
    modules: LibraryModule[],
): [publicModules: LibraryModule[], hiddenModules: LibraryModule[]] {
    const sorted = [...modules].sort((a, b) => (a.entry < b.entry ? -1 : 1))

    return [
        sorted.filter(({ root }) => !root.hidden),
        sorted.filter(({ root }) => root.hidden),
    ]
}

/** Collects module tier into import map and guards against duplicate global bindings. */
export function importMapOf(
    file: string,
    root: ApiRoot,
    tier: LibraryModule[],
): ImportMap {
    const modules: ImportMapModule[] = []
    const claimed = new Map<string, string>()

    for (const { specifier, global, interop } of tier) {
        // Skip type-only or rootless modules
        if (!global) continue

        const owner = claimed.get(global)
        if (owner)
            throw new Error(
                `"${specifier}" and "${owner}" modules cannot share the same ${root.name}.${global} property.`,
            )

        claimed.set(global, specifier)
        modules.push({ specifier, global, interop })
    }

    return { file, root, modules }
}

/** Serializes import map to JSON record. */
export function serializeImportMap({
    root,
    modules,
}: ImportMap): Record<string, ImportMapEntry> {
    return Object.fromEntries(
        modules.map(({ specifier, global, interop }) => {
            const path = `${root.name}.${global}`
            return [specifier, interop ? { global: path, interop } : path]
        }),
    )
}

export function writeJson(path: string, value: unknown): Promise<void> {
    return writeFile(path, `${JSON.stringify(value, null, 4)}\n`)
}
