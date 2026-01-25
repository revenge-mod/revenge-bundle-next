import { main } from 'bun'
import chalk from 'chalk'
import { exists, mkdir, rm } from 'fs/promises'
import { rolldown } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'
import pkg from '../package.json'

const PATHS = {
    lib: 'lib',
    output: 'dist/types',
    outputTemp: 'dist/types/.build',
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
        const bundle = await rolldown({
            input: {
                ...Object.fromEntries(
                    Libraries.flatMap(([libName, exports]) =>
                        exports.map(([exportName, path]) => [
                            `lib/${libName}${exportName && `/${exportName}`}`,
                            path,
                        ]),
                    ),
                ),
                globals: './types/globals.consumers.ts',
            },
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
                    resolve: true,
                }),
            ],
        })

        await bundle.write({
            dir: PATHS.output,
        })

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
import modules from 'pkg:modules'
import patcher from 'pkg:patcher'
import plugins from 'pkg:plugins'
import react from 'pkg:react'
import storage from 'pkg:storage'
import utils from 'pkg:utils'
import { writeFileSync } from 'fs'

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
        'types/api',
        'utils/modules/finders',
        'utils/modules/metro/subscriptions',
    ]),
    library(externals, [
        'browserify',
        'react-native-clipboard',
        'react-navigation',
        'shopify',
        'types',
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
    library(plugins, ['constants', 'types']),
    library(react, ['', 'jsx-runtime', 'native', 'types']),
    library(storage, ['', 'types']),
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
