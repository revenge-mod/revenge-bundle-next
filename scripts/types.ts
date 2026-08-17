import chalk from 'chalk'
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
import { rolldown } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import assets from '../lib/assets/package.json' with { type: 'json' }
import components from '../lib/components/package.json' with { type: 'json' }
import discord from '../lib/discord/package.json' with { type: 'json' }
import externals from '../lib/externals/package.json' with { type: 'json' }
import hidden from '../lib/hidden/package.json' with { type: 'json' }
import jsonStorage from '../lib/json-storage/package.json' with { type: 'json' }
import modules from '../lib/modules/package.json' with { type: 'json' }
import patcher from '../lib/patcher/package.json' with { type: 'json' }
import plugins from '../lib/plugins/package.json' with { type: 'json' }
import react from '../lib/react/package.json' with { type: 'json' }
import utils from '../lib/utils/package.json' with { type: 'json' }
import pkg from '../package.json' with { type: 'json' }
import { exists } from './_shared'

const TYPES_PACKAGE_NAME = '@revenge-mod/types'

const TYPES_PACKAGE_DEPENDENCIES = ['buffer']

const TYPES_PACKAGE_PEER_DEPENDENCIES = [
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

const TYPES_PACKAGE_OPTIONAL_PEER_DEPENDENCIES = [
    '@react-navigation/core',
    '@react-navigation/native',
    '@react-navigation/stack',
    '@shopify/flash-list',
    '@types/node',
    'react-native-safe-area-context',
]

const PATHS = {
    lib: 'lib',
    output: 'dist/types',
    outputTemp: 'dist/types/tmp',
    tsconfig: 'tsconfig.json',
} as const

/** Libraries that are hidden in their entirety. */
const HIDDEN_LIBRARIES = ['hidden']

/** Matches `_` used as a whole path segment, which is how internal exports are named. */
const HIDDEN_SEGMENT = /(?:^|\/)_(?:\/|$)/

/**
 * Hidden modules are internal APIs.
 *
 * Generated like everything else, but kept out of `index.d.ts` and `modules.json`
 * so consumers only get them if they ask for them (`@revenge-mod/types/hidden`).
 *
 * @param name A module name, without the `lib/` prefix (eg. `plugins/_`).
 */
function isHiddenModule(name: string): boolean {
    return (
        HIDDEN_LIBRARIES.includes(name.split('/')[0]!) ||
        HIDDEN_SEGMENT.test(name)
    )
}

type TrimLeadingDot<T extends string> = T extends `.${infer R}`
    ? R extends `/${infer S}`
        ? S
        : R
    : T

type ExportBinding<T extends string> = T | [from: T, to: string]

export default async function buildTypes(log = true): Promise<void> {
    const start = performance.now()

    await cleanup(PATHS.output, 'generated types')
    await mkdir(PATHS.outputTemp, { recursive: true })

    if (log) console.info(chalk.gray('🏗️  Generating types...'))

    try {
        const input: Record<string, string> = {
            ...Object.fromEntries(
                getLibraries().flatMap(([libName, exports]) =>
                    exports.map(([exportName, path]) => [
                        `lib/${libName}${exportName ? `/${exportName}` : ''}`,
                        path,
                    ]),
                ),
            ),
            globals: './types/globals.consumers.ts',
        }

        const bundle = await rolldown({
            input,
            external: Object.keys({
                ...pkg.dependencies,
                ...pkg.devDependencies,
            }),
            plugins: [
                dts({
                    tsconfig: PATHS.tsconfig,
                    parallel: true,
                    emitDtsOnly: true,
                    eager: true,
                }),
            ],
        })

        await bundle.write({ dir: PATHS.output })

        await internalizeSpecifiers(input)

        // Emitting hidden types separately would duplicate shared chunks and the ambient globals,
        // and a consumer loading both roots would get duplicate declarations.
        // So we do this once here.
        const [publicEntries, hiddenEntries] = partitionEntries(input)

        await writeFile(
            `${PATHS.output}/index.d.ts`,
            await generateIndex(publicEntries),
        )

        await writeFile(
            `${PATHS.output}/hidden.d.ts`,
            await generateIndex(hiddenEntries),
        )

        await writeFile(
            `${PATHS.output}/modules.json`,
            `${JSON.stringify(modulesOf(publicEntries), null, 4)}\n`,
        )

        await writeFile(
            `${PATHS.output}/modules.hidden.json`,
            `${JSON.stringify(modulesOf(hiddenEntries), null, 4)}\n`,
        )

        // Make dist/types directly publishable
        await writeFile(
            `${PATHS.output}/package.json`,
            `${JSON.stringify(
                {
                    name: TYPES_PACKAGE_NAME,
                    version: pkg.version,
                    types: 'index.d.ts',
                    files: ['modules.json', 'modules.hidden.json'],
                    exports: {
                        '.': { types: './index.d.ts' },
                        './hidden': { types: './hidden.d.ts' },
                        './modules.json': { default: './modules.json' },
                        './modules.hidden.json': {
                            default: './modules.hidden.json',
                        },
                    },
                    imports: {
                        '#*': { types: './*.d.ts' },
                    },
                    dependencies: versionsOf(TYPES_PACKAGE_DEPENDENCIES),
                    peerDependencies: versionsOf(
                        TYPES_PACKAGE_PEER_DEPENDENCIES,
                    ),
                    peerDependenciesMeta: Object.fromEntries(
                        TYPES_PACKAGE_OPTIONAL_PEER_DEPENDENCIES.map(name => [
                            name,
                            { optional: true },
                        ]),
                    ),
                },
                null,
                4,
            )}\n`,
        )

        await auditExternalSpecifiers()

        if (log) {
            const duration = (performance.now() - start).toFixed(2)
            console.info(
                chalk.greenBright(
                    `✅ Generated library types! ${chalk.gray(`(took ${duration}ms)`)}`,
                ),
            )
        }
    } catch (error) {
        console.error(chalk.red('❌ Failed to generate types:'), error)
        throw error
    } finally {
        await cleanup(PATHS.outputTemp, 'temporary build files')
    }
}

function library<
    E extends Record<`.${string}`, { default?: string; types?: string }>,
>(
    pkg: { name: string; exports: E },
    exports: ExportBinding<TrimLeadingDot<Extract<keyof E, string>>>[],
): [name: string, exports: [exportName: string, path: string][]] {
    const mapped: [exportName: string, path: string][] = []
    const bindings: Record<string, { from: string; path: string }[]> = {}
    const pkgName = pkg.name.split('/').at(-1)!

    for (const item of exports) {
        const isBinding = Array.isArray(item)
        const name = isBinding ? item[0] : item
        const actualName = isBinding ? item[1] : item

        const exportEntry = pkg.exports[`.${name ? `/${name}` : ''}`]
        if (!exportEntry) {
            console.warn(
                chalk.yellow(
                    `⚠️  Export "${name}" not found in "${pkg.name}" package.json`,
                ),
            )
            continue
        }

        const path = exportEntry.default ?? exportEntry.types
        if (!path) {
            console.warn(
                chalk.yellow(
                    `⚠️  No path found for export "${name}" in "${pkg.name}"`,
                ),
            )
            continue
        }

        if (isBinding) {
            ;(bindings[actualName] ??= []).push({
                from: name,
                path: `${PATHS.lib}/${pkgName}/${path}`,
            })
        } else {
            console.debug(
                chalk.gray(
                    `📄 ${pkgName}${name ? `/${name}` : ''} -> ${pkg.name}${name ? `/${name}` : ''}`,
                ),
            )
            mapped.push([actualName, `${PATHS.lib}/${pkgName}/${path}`])
        }
    }

    for (const [to, items] of Object.entries(bindings)) {
        if (items.length > 1) {
            const tempFileName = `${pkgName}_${to.replace(/[/\\?%*:|"<>]/g, '_')}`
            const tempPath = `${PATHS.outputTemp}/${tempFileName}.ts`
            const content = items
                .map(({ from }) => {
                    const path = `${pkg.name}/${from}`
                    console.debug(
                        chalk.gray(
                            `↔️  ${pkgName}${to ? `/${to}` : ''} -> ${path}`,
                        ),
                    )
                    return `export * from '${path}'`
                })
                .join('\n')

            try {
                writeFile(tempPath, content)
                mapped.push([to, tempPath])
            } catch (error) {
                console.error(
                    chalk.red(`❌ Failed to write temp file for ${to}:`),
                    error,
                )
            }
        } else if (items[0]) {
            mapped.push([to, items[0].path])
        }
    }

    return [pkgName, mapped]
}

function getLibraries() {
    return [
        library(assets, ['', 'types']),
        library(components, [
            '',
            'FormSwitch',
            'Page',
            'SearchInput',
            'TableRowAssetIcon',
            'types',
            '_',
        ]),
        library(discord, [
            'actions',
            'common/app-start-performance',
            'common/constants',
            'common/flux',
            'common/import-tracker',
            'common/logger',
            'common/tokens',
            'common/utils',
            'design',
            'flux',
            'modules/main_tabs_v2',
            'modules/settings',
            'modules/settings/renderer',
            'native',
            'types',
            'utils/modules/finders',
            'utils/modules/metro/subscriptions',
            '_/modules/settings',
        ]),
        library(externals, [
            'browserify',
            'react-native-clipboard',
            'react-native-safe-area-context',
            'react-navigation',
            'shopify',
        ]),
        library(modules, [
            'finders',
            'finders/filters',
            ['metro/subscriptions', 'metro'],
            ['metro/utils', 'metro'],
            'native',
            'native/app',
            'native/fs',
            'types',
        ]),
        library(patcher, ['', 'types']),
        library(plugins, [
            'constants',
            'types',
            'utils',
            '_',
            '_/repositories',
        ]),
        library(react, ['', 'jsx-runtime', 'native', 'types']),
        library(jsonStorage, ['', 'types']),
        library(hidden, ['', 'types']),
        library(utils, [
            'callback',
            'discord',
            'error',
            'object',
            'promise',
            'proxy',
            'react',
            'tree',
            'types',
        ]),
    ] as const
}

async function cleanup(dir: string, description: string): Promise<void> {
    try {
        if (await exists(dir)) {
            await rm(dir, { recursive: true, force: true })
            console.debug(chalk.gray(`🗑️  Deleted ${description}...`))
        }
    } catch (error) {
        console.warn(
            chalk.yellow(`⚠️  Failed to delete ${description}: ${error}`),
        )
    }
}

/**
 * Rewrites `@revenge-mod/*` to its package-private `#lib/*`, **except** in module augmentation
 * headers (`declare module '@revenge-mod/*'`).
 *
 * Augmentations must keep targeting the public module names, because that is what consumers
 * augment too. TypeScript merges every augmentation of an ambient module into the same symbol,
 * so mixing the two forms would split them: our own augmentations would land on the internal
 * module while a consumer's landed on the ambient one, and neither would see the other.
 */
async function internalizeSpecifiers(
    input: Record<string, string>,
): Promise<void> {
    const entries = new Set(
        Object.keys(input)
            .filter(entry => entry.startsWith(`${PATHS.lib}/`))
            .map(entry => entry.slice(`${PATHS.lib}/`.length)),
    )

    const pattern = new RegExp(
        `(declare\\s+module\\s+)?(['"])@revenge-mod/(${Array.from(entries)
            .sort((a, b) => b.length - a.length)
            .map(entry => entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|')})\\2`,
        'g',
    )

    const files = await readdir(PATHS.output, {
        recursive: true,
        withFileTypes: true,
    })

    await Promise.all(
        files.map(async file => {
            if (!file.isFile() || !file.name.endsWith('.d.ts')) return

            const path = `${file.parentPath}/${file.name}`
            const code = await readFile(path, 'utf8')
            const rewritten = code.replace(
                pattern,
                (match, augmentation, quote, entry) =>
                    augmentation
                        ? match
                        : `${quote}#${PATHS.lib}/${entry}${quote}`,
            )

            if (rewritten !== code) await writeFile(path, rewritten)
        }),
    )
}

/** Resolves the version ranges this repository uses for the given packages. */
function versionsOf(names: string[]): Record<string, string> {
    const versions: Record<string, string> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
    }

    return Object.fromEntries(
        names.map(name => {
            const version = versions[name]
            if (!version) {
                console.warn(
                    chalk.yellow(
                        `⚠️  "${name}" is declared for the types package but not installed here`,
                    ),
                )
            }
            return [name, version ?? '*']
        }),
    )
}

/** Warns about packages generated types use without the types package.json declaring them. */
async function auditExternalSpecifiers(): Promise<void> {
    const declared = new Set([
        ...TYPES_PACKAGE_DEPENDENCIES,
        ...TYPES_PACKAGE_PEER_DEPENDENCIES,
    ])

    const files = await readdir(PATHS.output, {
        recursive: true,
        withFileTypes: true,
    })

    const undeclared = new Map<string, string>()

    await Promise.all(
        files.map(async file => {
            if (!file.isFile() || !file.name.endsWith('.d.ts')) return

            const path = `${file.parentPath}/${file.name}`
            const code = (await readFile(path, 'utf8'))
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/^\s*\/\/.*$/gm, '')

            for (const [, specifier] of code.matchAll(
                /(?:from|import\()\s*["']([^"']+)["']/g,
            )) {
                if (/^[.#]|^@revenge-mod\//.test(specifier!)) continue

                const name = specifier!.startsWith('@')
                    ? specifier!.split('/').slice(0, 2).join('/')
                    : specifier!.split('/')[0]!

                if (!declared.has(name)) undeclared.set(name, path)
            }
        }),
    )

    for (const [name, path] of undeclared) {
        if (name.startsWith('node:')) continue

        console.warn(
            chalk.yellow(
                `⚠️  "${name}" is imported by ${path} but not declared by the types package`,
            ),
        )
    }
}

/**
 * Splits the generated entries into the public root and the hidden root.
 *
 * `globals` isn't a library entry, so it stays with the public root and is
 * referenced by `index.d.ts` only.
 */
function partitionEntries(
    input: Record<string, string>,
): [publicEntries: string[], hiddenEntries: string[]] {
    const publicEntries: string[] = []
    const hiddenEntries: string[] = []

    for (const entry of Object.keys(input).sort()) {
        if (
            entry.startsWith(`${PATHS.lib}/`) &&
            isHiddenModule(entry.slice(`${PATHS.lib}/`.length))
        )
            hiddenEntries.push(entry)
        else publicEntries.push(entry)
    }

    return [publicEntries, hiddenEntries]
}

/** Maps generated entries to the module names consumers import. */
function modulesOf(entries: string[]): string[] {
    return entries
        .filter(entry => entry.startsWith(`${PATHS.lib}/`))
        .map(entry => entry.slice(`${PATHS.lib}/`.length))
        .sort()
}

/** Generates a reference root (`index.d.ts` or `hidden.d.ts`). */
async function generateIndex(entries: string[]): Promise<string> {
    const references = entries.map(
        entry => `/// <reference path="./${entry}.d.ts" />`,
    )

    const shims: string[] = []

    for (const entry of entries) {
        if (entry === 'globals') continue

        const moduleName = entry.replace(/^lib\//, '@revenge-mod/')
        const typesPath = `#${entry}`
        const dts = await readFile(`${PATHS.output}/${entry}.d.ts`, 'utf8')
        const hasDefault = /\bas default\b|\bexport default\b/.test(dts)

        shims.push(
            `declare module '${moduleName}' {\n` +
                `    export * from '${typesPath}'\n` +
                (hasDefault
                    ? `    export { default } from '${typesPath}'\n`
                    : '') +
                '}',
        )
    }

    return `${references.join('\n')}\n\n${shims.join('\n\n')}\n`
}

if (import.meta.main) await buildTypes()
