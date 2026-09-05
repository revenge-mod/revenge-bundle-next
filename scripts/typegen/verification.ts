import chalk from 'chalk'
import { spawnSync } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import { writeJson } from './helpers'
import {
    Exports,
    Paths,
    TypesPackageDependencies,
    TypesPackagePeerDependencies,
    TypesPackageScope,
} from './shared'
import type { ImportMap } from './shared'

const TscBin = join('node_modules', '.bin', 'tsc')

/** Generated check file and type assertions. */
const CheckFile = 'check.ts'
const CheckApiType = 'UnscopedPluginApi'
const CheckApiModule = `@${TypesPackageScope}/plugins/types`

/** Pattern matching line numbers in `tsc` diagnostics. */
const CheckDiagnosticRegex = new RegExp(`${RegExp.escape(CheckFile)}\\((\\d+),`)

/** Specifiers resolved within the types package or by Node. */
const AuditIgnoredRegex = new RegExp(`^[.#]|^@${TypesPackageScope}/|^node:`)

/** Leading package name including scope. */
const PackageNameRegex = /^(?:@[^/]+\/[^/]+|[^/]+)/

const CheckTsconfig = {
    compilerOptions: {
        module: 'esnext',
        target: 'esnext',
        moduleResolution: 'bundler',
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        types: [],
    },
    include: [CheckFile],
}

/** Collector for imports the types package does not declare. */
export interface SpecifierAudit {
    /** Records undeclared imports found in a declaration. */
    scan(path: string, code: string): void
    /** Warns about every undeclared import recorded so far. */
    report(): void
}

/** Audits declaration outputs for undeclared dependencies. */
export function externalSpecifierAudit(): SpecifierAudit {
    const declared = new Set([
        ...TypesPackageDependencies,
        ...TypesPackagePeerDependencies,
    ])

    const undeclared = new Map<string, string>()

    return {
        scan(path, code) {
            const stripped = code
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/^\s*\/\/.*$/gm, '')

            for (const [, specifier] of stripped.matchAll(
                /(?:from|import\()\s*["']([^"']+)["']/g,
            )) {
                if (AuditIgnoredRegex.test(specifier!)) continue

                const [name] = PackageNameRegex.exec(specifier!) ?? []
                if (name && !declared.has(name)) undeclared.set(name, path)
            }
        },

        report() {
            for (const [name, path] of undeclared) {
                console.warn(
                    chalk.yellow(
                        `⚠️  "${name}" is imported by ${path} but not declared by the types package`,
                    ),
                )
            }
        },
    }
}

/**
 * Validates import maps against generated declarations using `tsc`.
 *
 * Emits and checks throwaway package asserting module types on `revenge`.
 */
export async function verifyImportMaps(maps: ImportMap[]): Promise<void> {
    const { source, specifierAt } = renderImportMapCheck(maps)

    await mkdir(Paths.verify, { recursive: true })
    await writeFile(join(Paths.verify, CheckFile), source)
    await writeJson(join(Paths.verify, 'tsconfig.json'), CheckTsconfig)

    const result = spawnSync(
        TscBin,
        ['-p', Paths.verify, '--pretty', 'false'],
        { encoding: 'utf8' },
    )

    if (result.error) throw result.error
    if (!result.status) return

    const reported = `${result.stdout ?? ''}${result.stderr ?? ''}`
        .split('\n')
        .filter(Boolean)
        .map(line => {
            const [, at] = CheckDiagnosticRegex.exec(line) ?? []
            const specifier = at && specifierAt.get(Number(at))
            return specifier ? `${specifier}\n    ${line}` : line
        })

    throw new Error(
        `Import maps don't match the generated types:\n${reported.join('\n')}`,
    )
}

/** Generated check source with specifiers indexed by line. */
interface ImportMapCheck {
    source: string
    specifierAt: Map<number, string>
}

/** Renders assertions binding every mapped module to its property path. */
function renderImportMapCheck(maps: ImportMap[]): ImportMapCheck {
    const root = resolve(Paths.output)

    const lines = [
        `/// <reference path="${join(root, Exports.types)}" />`,
        `/// <reference path="${join(root, Exports.hiddenTypes)}" />`,
        '',
        `import type { ${CheckApiType} } from '${CheckApiModule}'`,
        '',
        `export function check(revenge: ${CheckApiType}) {`,
    ]

    const specifierAt = new Map<number, string>()
    let index = 0

    for (const map of maps)
        for (const { specifier, global, interop } of map.modules) {
            const type = `typeof import('${specifier}')${interop ? `.${interop}` : ''}`

            lines.push(
                `    const _${index++}: ${type} = ${map.root.access}.${global}`,
            )
            specifierAt.set(lines.length, specifier)
        }

    lines.push('}', '')

    return { source: lines.join('\n'), specifierAt }
}
