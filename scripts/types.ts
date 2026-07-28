import { main } from 'bun'
import chalk from 'chalk'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { rolldown } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import pkg from '../package.json'

const TYPES_PACKAGE_NAME = '@revenge-mod/types'

const PATHS = {
    lib: 'lib',
    output: 'dist/types',
    outputTemp: 'dist/types/tmp',
    tsconfig: 'tsconfig.json',
} as const

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

await cleanup(PATHS.output, 'generated types')
await mkdir(PATHS.outputTemp, { recursive: true })

export default async function buildTypes(log = true): Promise<void> {
    const start = performance.now()

    if (log) console.info(chalk.gray('🏗️  Generating types...'))

    try {
        const input: Record<string, string> = {
            ...Object.fromEntries(
                Libraries.flatMap(([libName, exports]) =>
                    exports.map(([exportName, path]) => [
                        `lib/${libName}${exportName && `/${exportName}`}`,
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

        await bundle.write({
            dir: PATHS.output,
        })

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
                },
                null,
                4,
            )}\n`,
        )

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
import { writeFileSync } from 'fs'
import { exists } from './_shared'

type TrimLeadingDotAndMaybeSlash<T extends string> = T extends `.${infer R}`
    ? R extends `/${infer S}`
        ? S
        : R
    : T

type NameBinding<Exp extends string> = [original: Exp, to: string]
type Exports<Exp extends string> = Exp | NameBinding<Exp>

function library<
    E extends Record<`.${string}`, { default?: string; types?: string }>,
>(
    pkg: { name: string; exports: E },
    exports: Exports<TrimLeadingDotAndMaybeSlash<Extract<keyof E, string>>>[],
): [name: string, exports: [exportName: string, path: string][]] {
    const mapped: [exportName: string, path: string][] = []
    const bindings: Record<string, [exportName: string, path: string][]> = {}
    const pkgName = pkg.name.split('/').at(-1)!

    for (const nameOrBinding of exports) {
        const isBinding = Array.isArray(nameOrBinding)
        const name = isBinding ? nameOrBinding[0] : nameOrBinding

        const exportEntry = pkg.exports[`.${name ? `/${name}` : ''}`]
        if (!exportEntry) {
            console.warn(
                chalk.yellow(
                    `⚠️  Export "${name}" not found in "${pkg.name}" package.json`,
                ),
            )
            continue
        }

        const { default: defaultPath, types } = exportEntry
        const actualName = isBinding ? nameOrBinding[1] : name
        const path = defaultPath ?? types

        if (!path) {
            console.warn(
                chalk.yellow(
                    `⚠️  No path found for export "${name}" in "${pkg.name}"`,
                ),
            )
            continue
        }

        if (isBinding) (bindings[actualName] ??= []).push([actualName, name])
        else {
            console.debug(
                chalk.gray(
                    `📄 ${pkgName}${name && `/${name}`} -> ${pkg.name}${name && `/${name}`}`,
                ),
            )
            mapped.push([actualName, `${PATHS.lib}/${pkgName}/${path}`])
        }
    }

    for (const [to, froms] of Object.entries(bindings)) {
        if (froms.length > 1) {
            const tempFileName = Array.from(
                crypto.getRandomValues(new Uint8Array(4)),
            )
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')

            const tempPath = `${PATHS.outputTemp}/${tempFileName}.ts`
            const content = froms
                .map(([, from]) => {
                    const path = `${pkg.name}/${from}`
                    console.debug(
                        chalk.gray(`↔️  ${pkgName}${to && `/${to}`} -> ${path}`),
                    )

                    return `export * from '${path}'`
                })
                .join('\n')

            try {
                writeFileSync(tempPath, content)
                mapped.push([to, tempPath])
            } catch (error) {
                console.error(
                    chalk.red(`❌ Failed to write temp file for ${to}:`),
                    error,
                )
            }
        } else if (froms[0]) {
            mapped.push(froms[0])
        }
    }

    return [pkgName, mapped]
}

/**
 * Generates `index.d.ts` for the published types package.
 *
 * Consumers install the types package and add it to their tsconfig `types`, which loads a file that:
 *
 * - References `globals.d.ts` so global declarations (eg. `plugin()`, `revenge`) apply.
 * - Declares an ambient module for every public entry that re-exports the generated types file
 *   via a package-private `imports` (eg. `#lib/assets`), which resolves inside the types package
 *   without being importable to consumers.
 */
async function generateIndex(input: Record<string, string>): Promise<string> {
    const shims: string[] = []

    for (const entry of Object.keys(input).sort()) {
        // not importable, it's included via the reference above
        if (entry === 'globals') continue

        const moduleName = entry.replace(/^lib\//, '@revenge-mod/')
        const typesPath = `#${entry}`
        const dts = await readFile(`${PATHS.output}/${entry}.d.ts`, 'utf8')
        // `export *` does not re-export default exports
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

    return `/// <reference path="./globals.d.ts" />\n\n${shims.join('\n\n')}\n`
}

const Libraries = [
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
        'common',
        'common/flux',
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

if (main === import.meta.filename) await buildTypes()
