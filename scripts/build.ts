import { transform } from '@swc/core'
import { $, main } from 'bun'
import chalk from 'chalk'
import { exists, mkdir, readdir, rm, writeFile } from 'fs/promises'
import { parse } from 'path'
import { rolldown } from 'rolldown'
import { aliasPlugin, importGlobPlugin } from 'rolldown/experimental'
import pkg from '../package.json'
import type { OutputChunk, RolldownPlugin } from 'rolldown'

const ShimsDir = `${import.meta.dir}/../shims`
const AssetsDir = `${import.meta.dir}/../src/assets`
const GeneratedAssetsDir = `${import.meta.dir}/../dist/assets/generated`

await rm(GeneratedAssetsDir, { recursive: true, force: true })
    .then(() => {
        console.debug(chalk.gray('\u{1F5BB} Deleted old generated assets'))
    })
    .catch()

// If this file is being run directly, build the project
if (main === import.meta.filename) build()

export default async function build(dev = false, log = true) {
    const start = performance.now()

    if (log) console.info(chalk.gray('\u{1F5BB} Generating assets...'))
    await generateAssets()
    if (log) console.info(chalk.cyanBright('\u{1F5BB} Assets generated'))
    if (log) console.info(chalk.gray('\u{1F5CE} Compiling JS...'))

    const bundle = await rolldown({
        input: 'src/index.ts',
        platform: 'neutral',
        experimental: {
            strictExecutionOrder: true,
        },
        resolve: {
            tsconfigFilename: 'tsconfig.json',
        },
        treeshake: true,
        keepNames: true,
        moduleTypes: {
            '.webp': 'dataurl',
        },
        define: {
            __BUILD_VERSION__: JSON.stringify(pkg.version),
            __BUILD_COMMIT__: JSON.stringify(
                (await $`git rev-parse HEAD`.text()).trim().substring(0, 7),
            ),
            __BUILD_BRANCH__: JSON.stringify(
                (await $`git rev-parse --abbrev-ref HEAD`.text()).trim(),
            ),
            __BUILD_ENV__: JSON.stringify(dev ? 'development' : 'production'),

            // See types.d.ts for what these flags do
            __BUILD_FLAG_DEBUG_MODULE_LOOKUPS: 'false',
            __BUILD_FLAG_DEBUG_PROXIFIED_VALUES: 'false',
            __BUILD_FLAG_LOG_PROMISE_REJECTIONS__: String(dev),
        },
        plugins: [
            aliasPlugin({
                entries: [
                    {
                        find: 'react/jsx-runtime',
                        replacement: `${ShimsDir}/react~jsx-runtime.ts`,
                    },
                    // Do not move React to the top!
                    // If you do that, react/jsx-runtime would resolve to ${ShimsDir}/react.ts/jsx-runtime instead.
                    {
                        find: 'react',
                        replacement: `${ShimsDir}/react.ts`,
                    },
                    {
                        find: 'react-native',
                        replacement: `${ShimsDir}/react-native.ts`,
                    },
                ],
            }),
            importGlobPlugin(),
            swcPlugin(),
            hermesCPlugin({
                flags: [
                    dev ? '-Og' : '-O',
                    '-eager',
                    '-finline',
                    '-fno-static-require',
                    '-Wno-direct-eval',
                    '-Wno-undefined-variable',
                ],
                before() {
                    if (log)
                        console.debug(
                            chalk.cyanBright(
                                '\u{1F5CE} JS compilation finished...',
                            ),
                        )
                    if (log)
                        console.debug(
                            chalk.gray('\u{1F5CE} Compiling bytecode...'),
                        )
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
        minify: {
            compress: false,
            mangle: true,
        },
        file: 'dist/revenge.js',
        format: 'iife',
    })

    if (log)
        console.info(
            chalk.greenBright(
                `\u{2714} Compiled successfully! ${chalk.gray(`(took ${(performance.now() - start).toFixed(2)}ms)`)}`,
            ),
        )
}

function swcPlugin() {
    return {
        name: 'swc',
        transform: {
            filter: {
                id: /\.[cm]?[jt]sx?$/,
            },
            handler(code) {
                return transform(code, {
                    jsc: {
                        transform: {
                            react: {
                                runtime: 'automatic',
                            },
                        },
                        parser: {
                            syntax: 'typescript',
                            tsx: true,
                        },
                    },
                    env: {
                        // https://github.com/facebook/hermes/blob/main/doc/Features.md
                        targets: 'fully supports es6',
                        include: [
                            'transform-async-generator-functions',
                            'transform-block-scoping',
                            'transform-classes',
                            'transform-duplicate-named-capturing-groups-regex',
                            'transform-named-capturing-groups-regex',
                        ],
                        exclude: [
                            // Async functions are supported, only async arrow functions aren't
                            // Source: https://github.com/facebook/hermes/issues/1395
                            'transform-async-to-generator',
                            'transform-exponentiation-operator',
                            'transform-logical-assignment-operators',
                            'transform-nullish-coalescing-operator',
                            'transform-numeric-separator',
                            'transform-object-rest-spread',
                            'transform-optional-catch-binding',
                            'transform-optional-chaining',
                            'transform-parameters',
                            'transform-template-literals',
                        ],
                    },
                })
            },
        },
    } satisfies RolldownPlugin
}

function hermesCPlugin({
    after,
    before,
    flags,
}: {
    flags?: string[]
    before?: () => void
    after?: () => void
} = {}) {
    const paths = {
        win32: 'hermesc.exe',
        darwin: 'hermesc',
        linux: 'hermesc',
    }

    if (!(process.platform in paths))
        throw new Error(`Unsupported platform: ${process.platform}`)

    const binPath = paths[process.platform as keyof typeof paths]

    return {
        name: 'hermesc',
        generateBundle(_, bundle) {
            if (before) before()

            const file = bundle['revenge.js'] as OutputChunk
            if (!file || !file.code) throw new Error('No code to compile')

            // TODO(scripts/build): Remove this when we have a better way to add sourceURL
            file.code += `//# sourceURL=Revenge`

            const cmdlist = [
                `./node_modules/@unbound-mod/hermesc/${process.platform}/${binPath}`,
                '-emit-binary',
                ...(flags ?? []),
            ]

            const cmd = Bun.spawnSync(cmdlist, {
                // @ts-expect-error: Types are incorrect, but this works
                stdin: new Blob([file.code]),
                stdout: 'pipe',
            })

            const buf = cmd.stdout
            if (!buf.length)
                throw new Error(
                    `No output from hermesc. Probably a compilation error.\nTry running the command manually: ${cmdlist.join(' ')}`,
                )

            this.emitFile({
                type: 'asset',
                fileName: `${file.fileName.split('.')[0]!}.bundle`,
                source: buf,
            })

            if (after) after()
        },
    } satisfies RolldownPlugin
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
                `import{registerAsset}from'@revenge-mod/assets';import uri from${uriPath};const ${name}=registerAsset({name:'${name}',type:${type},uri});export default ${name}`,
            ),
        )
    }

    await Promise.all(promises)
}
