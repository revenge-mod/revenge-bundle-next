import chalk from 'chalk'
import { join } from 'path'
import { rolldown } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import pkg from '../../package.json' with { type: 'json' }
import { NoGlobal, Paths, TypesPackageScope } from './shared'
import { externalSpecifierAudit } from './verification'
import type { RolldownPlugin } from 'rolldown'
import type {
    ApiRoot,
    ExportBinding,
    GeneratedEntry,
    LibraryModule,
    MergeSource,
    ModuleNames,
    NormalizedBinding,
} from './shared'

/** Module augmentation header matching public specifiers. */
const Augmentation = String.raw`declare\s+module\s+`

/** Characters invalid in file names. */
const UnsafeInFilenameRegex = /[/\\?%*:|"<>]/g

/** Declaration re-exporting a default binding. */
const DefaultExportRegex = /\bas default\b|\bexport default\b/

// #region Naming

/**
 * Builds unique module name records.
 *
 * @param libName Library directory name, e.g. `modules`.
 * @param subpath Export subpath within library, empty for root.
 */
export function nameModule(
    libName: string,
    subpath: string,
): ModuleNames & Pick<GeneratedEntry, 'entry' | 'declaration'> {
    const name = subpath ? `${libName}/${subpath}` : libName
    const entry = `${Paths.lib}/${name}`

    return {
        name,
        entry,
        specifier: `@${TypesPackageScope}/${name}`,
        internalSpecifier: `#${entry}`,
        declaration: `${entry}.d.ts`,
    }
}

/** Returns package.json subpath export key. */
function exportKeyOf(subpath: string): string {
    return subpath ? `./${subpath}` : '.'
}

// #endregion

// #region Library declarations

/**
 * Normalizes export binding.
 *
 * Throws when global target is missing.
 */
export function normalizeBinding(
    item: ExportBinding<string>,
): NormalizedBinding {
    if (Array.isArray(item)) {
        const [name, global, interop] = item

        if (global === undefined)
            throw new Error(
                `Export "${name}" declares no global. Give it one, or NoGlobal if it hangs off no root.`,
            )

        return {
            name,
            global: global === NoGlobal ? undefined : global,
            interop,
        }
    }

    return { name: item.from, into: item.into, global: item.global }
}

/** Resolves export source path from package manifest. */
export function sourcePathOf(
    pkg: { name: string; exports: Record<string, unknown> },
    subpath: string,
): string | undefined {
    const entry = pkg.exports[exportKeyOf(subpath)] as
        | { default?: string; types?: string }
        | undefined

    if (!entry) {
        console.warn(
            chalk.yellow(
                `⚠️  Export "${subpath}" not found in "${pkg.name}" package.json`,
            ),
        )
        return
    }

    const path = entry.default ?? entry.types
    if (!path)
        console.warn(
            chalk.yellow(
                `⚠️  No path found for export "${subpath}" in "${pkg.name}"`,
            ),
        )

    return path
}

/** Builds synthetic merged module re-exporting multiple entrypoints. */
export function mergeModule(
    pkgName: string,
    libName: string,
    into: string,
    sources: MergeSource[],
    root: ApiRoot,
): LibraryModule {
    const globals = new Set(sources.map(({ global }) => global))
    if (globals.size > 1)
        throw new Error(
            `Merged exports of "${libName}/${into}" must have only one global, but got: ${[...globals].join(', ')}`,
        )

    const merged = {
        ...nameModule(libName, into),
        root,
        global: sources[0]!.global,
    }

    if (sources.length === 1) return { ...merged, path: sources[0]!.path }

    const fileName = `${libName}_${into.replace(UnsafeInFilenameRegex, '_')}.ts`

    return {
        ...merged,
        path: join(Paths.outputTemp, fileName),
        source: sources
            .map(({ name }) => {
                const specifier = `${pkgName}/${name}`
                console.debug(
                    chalk.gray(`↔️  ${libName}/${into} -> ${specifier}`),
                )
                return `export * from '${specifier}'`
            })
            .join('\n'),
    }
}

// #endregion

// #region Emission

/** Bundles entries into declaration chunks under output directory. */
export async function emitDeclarations(
    modules: LibraryModule[],
    ambient: GeneratedEntry[] = [],
): Promise<ReadonlySet<string>> {
    const defaultExports = new Set<string>()

    const bundle = await rolldown({
        input: Object.fromEntries(
            [...ambient, ...modules].map(({ entry, path }) => [entry, path]),
        ),
        external: Object.keys({
            ...pkg.dependencies,
            ...pkg.devDependencies,
        }),
        plugins: [
            dts({
                tsconfig: Paths.tsconfig,
                parallel: true,
                emitDtsOnly: true,
                eager: true,
            }),
            declarationsPlugin(modules, defaultExports),
        ],
    })

    await bundle.write({ dir: Paths.output })

    return defaultExports
}

/**
 * Generates root index d.ts file.
 *
 * @param modules Declared modules in emission order.
 * @param ambient Referenced entries such as consumer globals.
 * @param defaultExports Declarations with default exports from {@link emitDeclarations}.
 */
export function generateIndex(
    modules: LibraryModule[],
    ambient: GeneratedEntry[],
    defaultExports: ReadonlySet<string>,
): string {
    const references = [...ambient, ...modules].map(
        ({ declaration }) => `/// <reference path="./${declaration}" />`,
    )

    const shims = modules.map(
        ({ specifier, internalSpecifier, declaration }) =>
            `declare module '${specifier}' {\n` +
            `    export * from '${internalSpecifier}'\n` +
            (defaultExports.has(declaration)
                ? `    export { default } from '${internalSpecifier}'\n`
                : '') +
            '}',
    )

    return `${references.join('\n')}\n\n${shims.join('\n\n')}\n`
}

/**
 * Processes chunks in single pass during rolldown generation.
 *
 * Runs after `dts()` when declarations are final.
 *
 * @param defaultExports Filled with declarations re-exporting defaults.
 */
function declarationsPlugin(
    modules: LibraryModule[],
    defaultExports: Set<string>,
): RolldownPlugin {
    const internalize = specifierInternalizer(modules)
    const audit = externalSpecifierAudit()

    return {
        name: 'typegen-declarations',
        generateBundle(_options, bundle) {
            for (const [fileName, chunk] of Object.entries(bundle)) {
                if (chunk.type !== 'chunk' || !fileName.endsWith('.d.ts'))
                    continue

                chunk.code = internalize(chunk.code)

                // Join path to keep audit logs clickable
                audit.scan(join(Paths.output, fileName), chunk.code)
                if (DefaultExportRegex.test(chunk.code))
                    defaultExports.add(fileName)
            }

            audit.report()
        },
    }
}

/** Creates rewriter converting public specifiers to package-private aliases outside module declarations. */
function specifierInternalizer(
    modules: LibraryModule[],
): (code: string) => string {
    const internal = new Map(
        modules.map(({ specifier, internalSpecifier }) => [
            specifier,
            internalSpecifier,
        ]),
    )

    // Match longest specifier first
    const specifiers = [...internal.keys()]
        .sort((a, b) => b.length - a.length)
        .map(RegExp.escape)
        .join('|')
    const pattern = new RegExp(
        `(${Augmentation})?(['"])(${specifiers})\\2`,
        'g',
    )

    return code =>
        code.replace(pattern, (match, augmentation, quote, specifier) =>
            augmentation ? match : `${quote}${internal.get(specifier)}${quote}`,
        )
}

// #endregion
