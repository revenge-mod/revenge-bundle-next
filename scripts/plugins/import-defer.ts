import MagicString from 'magic-string'
import { parseAst } from 'rolldown/parseAst'
import type { RolldownPlugin } from 'rolldown'

/**
 * Support for `import defer` statements by transforming them to `require()`.
 *
 * `import defer` statements are transformed to provide on-demand/lazy loading.
 *
 * This is achieved by creating a scoped closure to cache the module.
 * - The deferred namespace import is converted to a function that triggers the `require()` when called.
 * - Usages like `ns.foo` are rewritten to `ns().foo` to execute the loader.
 */
export default function importDefer() {
    return {
        name: 'import-defer',
        transform(code, id) {
            // Cheap guard, so the whole module graph isn't parsed twice.
            if (!code.includes('import defer')) return null

            let program: Node
            try {
                program = parseAst(code, {
                    lang: langOf(id),
                }) as unknown as Node
            } catch {
                // Let rolldown report the syntax error itself.
                return null
            }

            const deferred = new Map<string, DeferredImport>()

            for (const node of program.body as Node[]) {
                if (node.type !== 'ImportDeclaration' || node.phase !== 'defer')
                    continue

                const [specifier] = node.specifiers as Node[]
                if (specifier?.type === 'ImportNamespaceSpecifier')
                    deferred.set((specifier.local as Node).name as string, {
                        node,
                        source: (node.source as Node).value as string,
                    })
            }

            if (!deferred.size) return null

            const s = new MagicString(code)

            for (const [name, { node, source }] of deferred)
                s.overwrite(
                    node.start,
                    node.end,
                    generateDeferReplacement(name, source),
                )

            walk(program, null, null, (node, parent, key) => {
                if (node.type === 'JSXIdentifier') {
                    // `<ns.Foo />` can't become `<ns().Foo />`, JSX element
                    // names don't allow calls. This plugin has to run after
                    // JSX has been compiled to `jsx(ns.Foo, ...)` calls.
                    if (deferred.has(node.name as string))
                        throw new Error(
                            `[import-defer] ${node.name} is a deferred import used directly in JSX (${id}). ` +
                                'Run this plugin after the JSX transform.',
                        )

                    return
                }

                if (node.type !== 'Identifier') return

                const name = node.name as string
                if (!deferred.has(name)) return
                if (!isReference(parent, key)) return

                // Shorthand property: `{ ns }` has to keep its key.
                if (parent?.type === 'Property' && parent.shorthand)
                    s.appendLeft(node.end, `: ${name}()`)
                else s.appendLeft(node.end, '()')
            })

            return {
                code: s.toString(),
                map: s.generateMap({ hires: true }),
            }
        },
    } satisfies RolldownPlugin
}

interface Node {
    type: string
    start: number
    end: number
    /** Loosely typed, this only ever reads a handful of well-known keys. */
    [key: string]: any
}

interface DeferredImport {
    node: Node
    source: string
}

/** TypeScript nodes that wrap a real expression, rather than being a type. */
const TsExpressionWrappers = new Set([
    'TSAsExpression',
    'TSInstantiationExpression',
    'TSNonNullExpression',
    'TSSatisfiesExpression',
    'TSTypeAssertion',
])

/** Properties that only ever hold types. */
const TypeKeys = new Set([
    'implements',
    'returnType',
    'superTypeArguments',
    'typeAnnotation',
    'typeArguments',
    'typeParameters',
])

type Visitor = (node: Node, parent: Node | null, key: string | null) => void

function walk(
    node: Node,
    parent: Node | null,
    key: string | null,
    visit: Visitor,
) {
    visit(node, parent, key)

    // A type, not code. `TSAsExpression` and similar still wrap an expression.
    if (node.type.startsWith('TS')) {
        if (!TsExpressionWrappers.has(node.type)) return

        walk(node.expression, node, 'expression', visit)
        return
    }

    // Already replaced wholesale.
    if (node.type === 'ImportDeclaration') return

    for (const childKey in node) {
        if (childKey === 'type' || TypeKeys.has(childKey)) continue

        const value = node[childKey]
        if (!value || typeof value !== 'object') continue

        if (Array.isArray(value)) {
            for (const item of value)
                if (isNode(item)) walk(item, node, childKey, visit)
        } else if (isNode(value)) walk(value, node, childKey, visit)
    }
}

function isNode(value: unknown): value is Node {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as Node).type === 'string' &&
        typeof (value as Node).start === 'number'
    )
}

/**
 * Whether this identifier actually reads the binding, as opposed to naming a
 * property, declaring something, or shadowing it.
 */
function isReference(parent: Node | null, key: string | null) {
    if (!parent) return true

    switch (parent.type) {
        // `foo.ns` is a property, `foo[ns]` is a read.
        case 'MemberExpression':
        case 'JSXMemberExpression':
            return key !== 'property' || Boolean(parent.computed)

        case 'Property':
            // `{ ns }` visits the same node as both key and value.
            if (parent.shorthand) return key === 'value'
            return key !== 'key' || Boolean(parent.computed)

        case 'MethodDefinition':
        case 'PropertyDefinition':
            return key !== 'key' || Boolean(parent.computed)

        // Declarations shadow the import rather than reading it.
        case 'VariableDeclarator':
            return key !== 'id'

        case 'ArrowFunctionExpression':
        case 'ClassDeclaration':
        case 'ClassExpression':
        case 'FunctionDeclaration':
        case 'FunctionExpression':
            return key !== 'id' && key !== 'params'

        case 'ExportSpecifier':
        case 'ImportDefaultSpecifier':
        case 'ImportNamespaceSpecifier':
        case 'ImportSpecifier':
        case 'BreakStatement':
        case 'ContinueStatement':
        case 'LabeledStatement':
            return false

        default:
            return true
    }
}

function langOf(id: string) {
    const path = id.split('?')[0]

    if (path.endsWith('.tsx')) return 'tsx' as const
    if (path.endsWith('.jsx')) return 'jsx' as const
    if (/\.[cm]?ts$/.test(path)) return 'ts' as const

    return 'js' as const
}

function generateDeferReplacement(localName: string, modulePath: string) {
    const cacheVar = `_cache_${modulePath.replace(/[^a-zA-Z0-9]/g, '_')}`

    return `var ${cacheVar};const ${localName}=()=>${cacheVar}??=require('${modulePath}');`
}
