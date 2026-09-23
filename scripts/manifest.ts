import { readdir, readFile } from 'fs/promises'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { ReservedDependencyIds } from '../lib/plugins/src/_internal/manifest'
import { exists } from './_shared'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const PluginsDir = `${__dirname}/../src/plugins`

interface BundleManifestPlugin {
    id: string
    dependencies?: Record<string, { version?: string }>
}

interface RawBundleManifestPlugin extends BundleManifestPlugin {
    build?: {
        devOnly?: boolean
    }
}

export async function getInternalPluginManifests(
    root = PluginsDir,
    dev = false,
): Promise<BundleManifestPlugin[]> {
    const manifests: BundleManifestPlugin[] = []
    const seen = new Map<string, string>()

    for (const stage of await readdir(root, { withFileTypes: true })) {
        if (!stage.isDirectory()) continue

        const stageDir = `${root}/${stage.name}`

        for (const plugin of await readdir(stageDir, { withFileTypes: true })) {
            if (!plugin.isDirectory()) continue

            const path = `${stageDir}/${plugin.name}/manifest.json`
            if (!(await exists(path))) continue

            const manifest = JSON.parse(
                await readFile(path, 'utf8'),
            ) as RawBundleManifestPlugin
            const where = `${stage.name}/${plugin.name}`

            if (!manifest.id)
                throw new Error(`Internal plugin at ${where} has no ID`)

            if (manifest.build?.devOnly && !dev) continue

            const clash = seen.get(manifest.id)
            if (clash)
                throw new Error(
                    `Internal plugins ${clash} and ${where} share the ID "${manifest.id}"`,
                )

            seen.set(manifest.id, where)
            manifests.push({
                id: manifest.id,
                ...(manifest.dependencies && {
                    dependencies: manifest.dependencies,
                }),
            })
        }
    }

    for (const { id, dependencies } of manifests)
        for (const depId in dependencies)
            if (!seen.has(depId) && !ReservedDependencyIds.has(depId))
                throw new Error(
                    `Internal plugin "${id}" depends on "${depId}", which is not an internal plugin`,
                )

    return manifests
}

export function getBundleManifest(
    version: string,
    plugins: BundleManifestPlugin[],
) {
    return {
        version,
        plugins,
    }
}
