import assets from 'pkg:assets'
import components from 'pkg:components'
import discord from 'pkg:discord'
import externals from 'pkg:externals'
import jsonStorage from 'pkg:json-storage'
import modules from 'pkg:modules'
import patcher from 'pkg:patcher'
import plugins from 'pkg:plugins'
import react from 'pkg:react'
import utils from 'pkg:utils'
import { main } from 'bun'
import chalk from 'chalk'
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
import { rolldown } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import pkg from '../package.json'
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
                ...pkg.peerDependencies,
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

        await writeFile(
            `${PATHS.output}/index.d.ts`,
            await generateIndex(input),
        )

        // Make dist/types directly publishable
        await writeFile(
            `${PATHS.output}/package.json`,
            `${JSON.stringify(
                {
                    name: TYPES_PACKAGE_NAME,
                    version: pkg.version,
                    types: 'index.d.ts',
                    exports: {
                        '.': { types: './index.d.ts' },
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
            'native/fs',
            'types',
        ]),
        library(patcher, ['', 'types']),
        library(plugins, ['constants', 'types', 'utils']),
        library(react, ['', 'jsx-runtime', 'native', 'types']),
        library(jsonStorage, ['', 'types']),
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

/** Rewrites `@revenge-mod/*` to its package-private `#lib/*. */
async function internalizeSpecifiers(
    input: Record<string, string>,
): Promise<void> {
    const entries = new Set(
        Object.keys(input)
            .filter(entry => entry.startsWith(`${PATHS.lib}/`))
            .map(entry => entry.slice(`${PATHS.lib}/`.length)),
    )

    const pattern = new RegExp(
        `(['"])@revenge-mod/(${Array.from(entries)
            .sort((a, b) => b.length - a.length)
            .map(entry => entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|')})\\1`,
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
                (_, quote, entry) => `${quote}#${PATHS.lib}/${entry}${quote}`,
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
        ...pkg.peerDependencies,
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
        console.warn(
            chalk.yellow(
                `⚠️  "${name}" is imported by ${path} but not declared by the types package`,
            ),
        )
    }
}

/** Generates `index.d.ts` for the published types package. */
async function generateIndex(input: Record<string, string>): Promise<string> {
    const entries = Object.keys(input).sort()

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

if (main === import.meta.filename) await buildTypes()
