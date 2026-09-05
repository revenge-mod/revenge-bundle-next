import chalk from 'chalk'
import pkg from '../../package.json' with { type: 'json' }
import {
    Exports,
    TypesPackageDependencies,
    TypesPackageName,
    TypesPackageOptionalPeerDependencies,
    TypesPackagePeerDependencies,
} from './shared'

/**
 * Builds package.json manifest for generated types package.
 *
 * @param assets JSON files shipped alongside the declarations.
 */
export function typesPackageManifest(assets: string[]) {
    return {
        name: TypesPackageName,
        version: pkg.version,
        types: Exports.types,
        files: assets,
        exports: {
            '.': { types: `./${Exports.types}` },
            './hidden': { types: `./${Exports.hiddenTypes}` },
            ...Object.fromEntries(
                assets.map(file => [`./${file}`, { default: `./${file}` }]),
            ),
        },
        imports: {
            '#*': { types: './*.d.ts' },
        },
        dependencies: versionsOf(TypesPackageDependencies),
        peerDependencies: versionsOf(TypesPackagePeerDependencies),
        peerDependenciesMeta: Object.fromEntries(
            TypesPackageOptionalPeerDependencies.map(name => [
                name,
                { optional: true },
            ]),
        ),
    }
}

/** Reads declared dependency versions from workspace manifest. */
function versionsOf(names: string[]): Record<string, string> {
    const versions: Record<string, string> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
    }

    return Object.fromEntries(
        names.map(name => {
            const version = versions[name]
            if (!version)
                console.warn(
                    chalk.yellow(
                        `⚠️  "${name}" is declared for the types package but not installed here`,
                    ),
                )

            return [name, version ?? '*']
        }),
    )
}
