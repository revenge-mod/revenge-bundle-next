import { $, main } from 'bun'
import chalk from 'chalk'
import { exists, mkdir, readdir, rm, writeFile } from 'fs/promises'
import { parse } from 'path'
import { rolldown } from 'rolldown'
import { importGlobPlugin } from 'rolldown/experimental'
import pkg from '../package.json'
import asRequire from './plugins/as-require'
import hermesSwcPlugin from './plugins/hermes-swc'
import hermesCPlugin from './plugins/hermesc'
import importDefer from './plugins/import-defer'
import shimAliases from './plugins/shim-aliases'

const ShimsDir = `${import.meta.dir}/../shims`
const AssetsDir = `${import.meta.dir}/../src/assets`
const GeneratedAssetsDir = `${import.meta.dir}/../dist/assets/generated`

await rm(GeneratedAssetsDir, { recursive: true, force: true })
    .then(() =>
        console.debug(chalk.gray('\u{1F5BB} Deleted old generated assets')),
    )
    .catch()

const Dev =
    process.argv.includes('--dev') || process.env.NODE_ENV === 'development'

// If this file is being run directly, build the project
if (main === import.meta.filename) build()

export default async function build(dev = Dev, log = true) {
    const start = performance.now()

    if (log) console.info(chalk.gray('\u{1F5BB} Generating assets...'))
    await generateAssets()
    if (log) console.info(chalk.cyanBright('\u{1F5BB} Assets generated'))
    if (log) console.info(chalk.gray('\u{1F5CE} Compiling JS...'))

    const COMMIT = (await $`git rev-parse HEAD`.text()).trim().substring(0, 7)
    const REPO = 'revenge-mod/revenge-bundle-next'

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
                __BUILD_DISCORD_SERVER_URL__: JSON.stringify(
                    'https://discord.com/invite/ddcQf3s2Uq',
                ),
                __BUILD_SOURCE_REPOSITORY_URL__: JSON.stringify(
                    `https://github.com/${REPO}`,
                ),
                __BUILD_LICENSE_URL__: JSON.stringify(
                    `https://raw.githubusercontent.com/${REPO}/${COMMIT}/LICENSE`,
                ),
                __BUILD_VERSION__: JSON.stringify(pkg.version),
                __BUILD_COMMIT__: JSON.stringify(COMMIT),
                __BUILD_BRANCH__: JSON.stringify(
                    (await $`git rev-parse --abbrev-ref HEAD`.text()).trim(),
                ),
                __DEV__: String(dev),

                // See types/build.d.ts for what these flags do
                __BUILD_FLAG_DEBUG_MODULE_LOOKUPS__: String(dev),
                __BUILD_FLAG_DEBUG_MODULE_WAITS__: String(dev),
                __BUILD_FLAG_DEBUG_LAZY_VALUES__: 'false',
                __BUILD_FLAG_LOG_PROMISE_REJECTIONS__: String(dev),
            },
        },
        tsconfig: 'tsconfig.json',
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
