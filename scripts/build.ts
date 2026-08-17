import dotenv from 'dotenv'

dotenv.config({ quiet: true })

import chalk from 'chalk'
import { execSync } from 'child_process'
import { mkdir, readdir, rm, writeFile } from 'fs/promises'
import { dirname, parse } from 'path'
import { rolldown } from 'rolldown'
import { importGlobPlugin } from 'rolldown/experimental'
import { fileURLToPath } from 'url'
import pkg from '../package.json' with { type: 'json' }
import { exists } from './_shared'
import asRequire from './plugins/as-require'
import hermesSwcPlugin from './plugins/hermes-swc'
import hermesCPlugin from './plugins/hermesc'
import importDefer from './plugins/import-defer'
import shimAliases from './plugins/shim-aliases'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ShimsDir = `${__dirname}/../shims`
const AssetsDir = `${__dirname}/../src/assets`
const GeneratedAssetsDir = `${__dirname}/../dist/assets/generated`
const Dev =
    process.argv.includes('--dev') || process.env.NODE_ENV === 'development'

// If this file is being run directly, build the project
if (import.meta.main) build()

export default async function build(dev = Dev, log = true) {
    await rm(GeneratedAssetsDir, { recursive: true, force: true })
        .then(() =>
            console.debug(chalk.gray('\u{1F5BB} Deleted old generated assets')),
        )
        .catch()

    const start = performance.now()

    if (log) console.info(chalk.gray('\u{1F5BB} Generating assets...'))
    await generateAssets()
    if (log) console.info(chalk.cyanBright('\u{1F5BB} Assets generated'))
    if (log) console.info(chalk.gray('\u{1F5CE} Compiling JS...'))

    const COMMIT = execSync('git rev-parse HEAD')
        .toString()
        .trim()
        .substring(0, 7)

    const bundle = await rolldown({
        input: 'src/index.ts',
        platform: 'neutral',
        external: [/^node:/],
        optimization: {
            inlineConst: {
                mode: 'smart',
                pass: 5,
            },
            pifeForModuleWrappers: true,
        },
        experimental: {
            lazyBarrel: true,
        },
        preserveEntrySignatures: false,
        transform: {
            define: {
                __BUILD_DISCORD_SERVER_URL__: stringEnv(
                    'REVENGE_DISCORD_SERVER_URL',
                ),
                __BUILD_SOURCE_REPOSITORY_URL__: stringEnv(
                    'REVENGE_SOURCE_REPOSITORY_URL',
                ),
                __BUILD_LICENSE_URL__: stringEnv('REVENGE_LICENSE_URL'),
                __BUILD_VERSION__: JSON.stringify(pkg.version),
                __BUILD_COMMIT__: JSON.stringify(COMMIT),
                __BUILD_BRANCH__: JSON.stringify(
                    execSync('git rev-parse --abbrev-ref HEAD')
                        .toString()
                        .trim(),
                ),
                __DEV__: String(dev),
                __BUILD_DEFAULT_PLUGIN_REPOSITORY_URL__: JSON.stringify(
                    stringEnv(
                        'REVENGE_DEFAULT_PLUGIN_REPOSITORY_URL',
                        undefined,
                        false,
                    ),
                ),
                __BUILD_DONATE_URL__: JSON.stringify(
                    stringEnv('REVENGE_DONATE_URL', undefined, false),
                ),

                // See types/build.d.ts for what these flags do
                __BUILD_FLAG_DEBUG_MODULE_LOOKUPS__: String(
                    boolEnv('REVENGE_DEBUG_MODULE_LOOKUPS', dev),
                ),
                __BUILD_FLAG_DEBUG_MODULE_WAITS__: String(
                    boolEnv('REVENGE_DEBUG_MODULE_WAITS', dev),
                ),
                __BUILD_FLAG_DEBUG_LAZY_VALUES__: String(
                    boolEnv('REVENGE_DEBUG_LAZY_VALUES', false),
                ),
                __BUILD_FLAG_LOG_PROMISE_REJECTIONS__: String(
                    boolEnv('REVENGE_LOG_PROMISE_REJECTIONS', dev),
                ),
            },
        },
        tsconfig: 'tsconfig.json',
        // propertyReadSideEffects: false works around a Rolldown bug where
        // property reads on tree-shaken import bindings are kept as "side
        // effects" while their imports are removed, producing free-variable
        // references (e.g. `FibonacciHeap.MinFibonacciHeap` from mnemonist's
        // barrel) that throw ReferenceError at runtime.
        treeshake: true,
        moduleTypes: {
            '.webp': 'dataurl',
        },
        plugins: [
            asRequire(),
            shimAliases(ShimsDir),
            importGlobPlugin(),
            hermesSwcPlugin(),
            importDefer(),
            hermesCPlugin({
                flags: [
                    dev ? '-Og' : '-O',
                    dev ? '-g3' : '-g1',
                    '-reuse-prop-cache',
                    '-optimized-eval',
                    '-strict',
                    '-finline',
                ],
                before(ver) {
                    if (log) {
                        console.debug(
                            chalk.cyanBright(
                                '\u{1F5CE} JS compilation finished...',
                            ),
                        )

                        console.debug(
                            chalk.gray(
                                `\u{1F5CE} Compiling bytecode with ${ver}...`,
                            ),
                        )
                    }
                },
                after() {
                    if (log)
                        console.debug(
                            chalk.cyanBright(
                                '\u{1F5CE} Bytecode compilation finished',
                            ),
                        )
                },
            }),
        ],
    })

    await bundle.write({
        minify: dev
            ? 'dce-only'
            : {
                  codegen: {
                      removeWhitespace: false,
                  },
                  mangle: {
                      keepNames: true,
                  },
                  compress: {
                      joinVars: true,
                      keepNames: {
                          class: true,
                          function: true,
                      },
                      unused: true,
                  },
              },
        esModule: false,
        minifyInternalExports: true,
        hoistTransitiveImports: false,
        file: 'dist/revenge.js',
        format: 'iife',
        keepNames: true,
        postFooter: `//# sourceURL=Revenge`,
        topLevelVar: true,
    })

    if (log)
        console.info(
            chalk.greenBright(
                `\u{2714} Compiled successfully! ${chalk.gray(`(took ${(performance.now() - start).toFixed(2)}ms)`)}`,
            ),
        )
}

async function generateAssets() {
    if (!(await exists(GeneratedAssetsDir)))
        await mkdir(GeneratedAssetsDir, { recursive: true })

    const promises: Promise<void>[] = []

    for (const file of await readdir(AssetsDir)) {
        const { name, ext } = parse(file)
        const path = `${AssetsDir}/${file}`
        const path2 = `${GeneratedAssetsDir}/${name}.js`

        if (await exists(path2)) continue

        // We attempt to sanitize the path, but not the name as it should fail if name contains invalid characters
        const uriPath = JSON.stringify(path)
        const type = JSON.stringify(ext.slice(1))

        promises.push(
            writeFile(
                path2,
                `import{registerAsset}from'@revenge-mod/assets';import uri from${uriPath};const ${name}=registerAsset({name:'${name}',type:${type},uri});export { ${name} as default }`,
            ),
        )
    }

    await Promise.all(promises)
}

function isEmpty(value: string | undefined): boolean {
    return value === undefined || value === ''
}

function boolEnv(key: string, defaultValue: boolean): boolean {
    const val = process.env[key]
    if (isEmpty(val)) return defaultValue
    return val === 'true' || val === '1'
}

function stringEnv(
    key: string,
    defaultValue?: string,
    required: boolean = true,
): string {
    const val = process.env[key]
    if (isEmpty(val)) {
        if (defaultValue === undefined) {
            if (required)
                throw new Error(`Environment variable ${key} is required`)
            return 'undefined'
        }
        return JSON.stringify(defaultValue)
    }
    return JSON.stringify(val)
}
