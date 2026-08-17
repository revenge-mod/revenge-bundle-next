import { describe, expect, test } from 'bun:test'
import importDefer from './import-defer'

type Transform = (
    code: string,
    id: string,
) => { code: string; map: { mappings: string } } | null

const transform = importDefer().transform as unknown as Transform

/** The declaration every fixture starts with. */
const Import = "import defer * as ns from './mod'"

/** What that declaration is rewritten into. */
const Thunk = "var _cache___mod;const ns=()=>_cache___mod??=require('./mod');"

/** Transforms a fixture body preceded by {@link Import}. */
function run(body: string, id = 'module.ts') {
    return transform(`${Import}\n${body}`, id)?.code ?? null
}

/** The expected output of {@link run} for an already-rewritten body. */
function expected(body: string) {
    return `${Thunk}\n${body}`
}

describe('importDefer', () => {
    describe('detection', () => {
        test('should ignore modules without a deferred import', () => {
            expect(
                transform("import * as ns from './mod'\nns.foo", 'a.ts'),
            ).toBe(null)
        })

        test('should ignore plain namespace imports even when the file mentions import defer', () => {
            // Passes the cheap substring guard, so the AST has the final say.
            expect(
                transform(
                    "// import defer is deliberately unused here\nimport * as ns from './mod'\nns.foo",
                    'a.ts',
                ),
            ).toBe(null)
        })

        test('should bail out instead of throwing on unparseable code', () => {
            // Rolldown reports the syntax error itself, with better framing.
            expect(run('const = )(')).toBe(null)
        })

        test('should produce a source map', () => {
            const result = transform(`${Import}\nns.foo`, 'module.ts')

            expect(result?.map.mappings).toBeTruthy()
        })
    })

    describe('declaration', () => {
        test('should rewrite the import into a cached require thunk', () => {
            expect(run('')).toBe(expected(''))
        })

        test('should derive a distinct cache variable per module path', () => {
            const code = transform(
                "import defer * as a from './a'\nimport defer * as b from './b/c.js'\na.x\nb.y",
                'module.ts',
            )?.code

            expect(code).toBe(
                "var _cache___a;const a=()=>_cache___a??=require('./a');\n" +
                    "var _cache___b_c_js;const b=()=>_cache___b_c_js??=require('./b/c.js');\n" +
                    'a().x\n' +
                    'b().y',
            )
        })
    })

    describe('references', () => {
        test('should rewrite member access', () => {
            expect(run('ns.foo')).toBe(expected('ns().foo'))
        })

        test('should rewrite a bare read', () => {
            expect(run('const x = ns')).toBe(expected('const x = ns()'))
        })

        test('should rewrite a computed member object and key', () => {
            expect(run('const x = foo[ns]')).toBe(
                expected('const x = foo[ns()]'),
            )
        })

        test('should rewrite a spread', () => {
            expect(run('const o = { ...ns }')).toBe(
                expected('const o = { ...ns() }'),
            )
        })

        test('should rewrite a destructuring initializer', () => {
            expect(run('const { foo } = ns')).toBe(
                expected('const { foo } = ns()'),
            )
        })

        test('should rewrite a superclass', () => {
            expect(run('class C extends ns.Base {}')).toBe(
                expected('class C extends ns().Base {}'),
            )
        })

        test('should rewrite a default export', () => {
            expect(run('export default ns')).toBe(
                expected('export default ns()'),
            )
        })

        test('should expand a shorthand property to keep its key', () => {
            expect(run('const o = { ns }')).toBe(
                expected('const o = { ns: ns() }'),
            )
        })
    })

    describe('non-references', () => {
        test('should leave a property key alone', () => {
            expect(run('const o = { ns: 1 }')).toBe(
                expected('const o = { ns: 1 }'),
            )
        })

        test('should leave a member property alone', () => {
            expect(run('const x = o.ns')).toBe(expected('const x = o.ns'))
        })

        test('should leave a label alone', () => {
            expect(run('ns: for (const x of y) break ns')).toBe(
                expected('ns: for (const x of y) break ns'),
            )
        })

        test('should leave a re-export alone', () => {
            // The thunk itself is exported, calling it here would defeat the defer.
            expect(run('export { ns }')).toBe(expected('export { ns }'))
        })
    })

    describe('text that only looks like a reference', () => {
        const traps: Array<[string, string]> = [
            // The bug this parser-based implementation was written to fix: a
            // lone apostrophe used to put the scanner "inside a string" for the
            // rest of the file, silently skipping every reference after it.
            ['an apostrophe in a line comment', "// Discord's dispatcher"],
            ['an apostrophe in a block comment', "/* Discord's dispatcher */"],
            ['a quote in a regex literal', "const r = /it's/"],
            ['the name in a line comment', '// ns.foo is deferred'],
            ['the name in a block comment', '/* ns.foo is deferred */'],
            ['the name in a string', "const s = 'ns.foo'"],
            ['the name in a template literal', 'const s = `ns.foo`'],
        ]

        test.each(traps)('should not be confused by %s', (_, trap) => {
            expect(run(`${trap}\nns.foo`)).toBe(expected(`${trap}\nns().foo`))
        })
    })

    describe('TypeScript', () => {
        test('should leave type annotations alone', () => {
            expect(run('let x: ns.Foo\nns.foo')).toBe(
                expected('let x: ns.Foo\nns().foo'),
            )
        })

        test('should rewrite the expression inside an assertion', () => {
            expect(run('const x = ns as never')).toBe(
                expected('const x = ns() as never'),
            )
        })

        test('should rewrite through a non-null assertion', () => {
            expect(run('const x = ns!.foo')).toBe(
                expected('const x = ns()!.foo'),
            )
        })
    })

    describe('JSX', () => {
        test('should rewrite a compiled JSX element type', () => {
            expect(run('_jsx(ns.Foo, {})')).toBe(expected('_jsx(ns().Foo, {})'))
        })

        test('should rewrite an expression container', () => {
            expect(run('const e = <div>{ns.foo}</div>', 'module.tsx')).toBe(
                expected('const e = <div>{ns().foo}</div>'),
            )
        })

        test('should refuse an uncompiled JSX element name', () => {
            // `<ns().Foo />` is not valid JSX, so this has to run after the JSX
            // transform. Failing loudly beats emitting broken output.
            expect(() =>
                transform(`${Import}\nconst e = <ns.Foo />`, 'module.tsx'),
            ).toThrow(/deferred import used directly in JSX/)
        })
    })

    describe('shadowing', () => {
        test('should leave a shadowing parameter declaration alone', () => {
            expect(run('function f(ns) {}')).toBe(expected('function f(ns) {}'))
        })

        // Known limitation: references are resolved structurally, without scope
        // analysis, so an inner binding of the same name is rewritten as though
        // it were the import. No module currently shadows a deferred namespace.
        // Remove `.failing` once scope tracking lands.
        test.failing('should leave references to a shadowing binding alone', () => {
            expect(run('function f(ns) { return ns.foo }')).toBe(
                expected('function f(ns) { return ns.foo }'),
            )
        })

        test.failing('should leave a shadowing destructuring pattern alone', () => {
            // Currently emits `const { ns: ns() }`, which is a syntax error.
            expect(run('function f(o) { const { ns } = o }')).toBe(
                expected('function f(o) { const { ns } = o }'),
            )
        })
    })
})
