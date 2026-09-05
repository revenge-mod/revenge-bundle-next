import chalk from 'chalk'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { exists } from './_shared'
import { emitDeclarations, generateIndex } from './typegen/generator'
import {
    importMapOf,
    partitionModules,
    serializeImportMap,
    writeJson,
} from './typegen/helpers'
import { getLibraries } from './typegen/libs'
import { typesPackageManifest } from './typegen/package'
import { Exports, HiddenApi, Paths, PublicApi } from './typegen/shared'
import { verifyImportMaps } from './typegen/verification'
import type { GeneratedEntry } from './typegen/shared'

/** Ambient declarations consumers get from the public root. Not a library module. */
const ConsumerGlobals: GeneratedEntry = {
    entry: 'globals',
    path: Paths.consumerGlobals,
    declaration: Exports.globals,
}

/** Generates the types package into the output directory. */
export default async function buildTypes(log = true): Promise<void> {
    const start = performance.now()

    await cleanup(Paths.output, 'generated types')
    await mkdir(Paths.outputTemp, { recursive: true })

    if (log) console.info(chalk.gray('🏗️  Generating types...'))

    try {
        const libraries = getLibraries()

        // Merged modules need additional files to be written
        for (const { path, source } of libraries) {
            if (source) await writeFile(path, source)
        }

        // Emit declarations together so there aren't conflicting duplicate chunks which consumers would have to consume.
        const defaultExports = await emitDeclarations(libraries, [
            ConsumerGlobals,
        ])

        const [publicModules, hiddenModules] = partitionModules(libraries)

        const importMaps = [
            importMapOf(Exports.importMap, PublicApi, publicModules),
            importMapOf(Exports.hiddenImportMap, HiddenApi, hiddenModules),
        ]

        await writeFile(
            join(Paths.output, Exports.types),
            generateIndex(publicModules, [ConsumerGlobals], defaultExports),
        )

        await writeFile(
            join(Paths.output, Exports.hiddenTypes),
            generateIndex(hiddenModules, [], defaultExports),
        )

        for (const map of importMaps)
            await writeJson(
                join(Paths.output, map.file),
                serializeImportMap(map),
            )

        // Make dist/types directly publishable
        await writeJson(
            join(Paths.output, Exports.manifest),
            typesPackageManifest(importMaps.map(({ file }) => file)),
        )

        await verifyImportMaps(importMaps)

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
        await cleanup(Paths.outputTemp, 'temporary build files')
        await cleanup(Paths.verify, 'import map verification files')
    }
}

/** Removes a generated directory, warning instead of throwing. */
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

if (import.meta.main) await buildTypes()
