import type { RolldownPlugin } from 'rolldown'

/**
 * Transforms `// @as-require` comments above supported import statements into `require` calls.
 *
 * Supported statements:
 * - Static side-effect imports: `import 'module'`
 * - Dynamic side-effect imports: `import('module')` and `await import('module')`
 */
export default function asRequire() {
    const name = 'as-require'

    return {
        name,
        transform(code, id) {
            if (!code.includes('// @as-require')) return null

            const asRequireRegex =
                /(?:\s*\/\/\s*@as-require\s*[\r\n]+)([^\r\n]*)/g

            let hasChanged = false
            const newCode = code.replace(asRequireRegex, (match, statement) => {
                const trimmedStatement = statement.trim()

                // import './mod' -> require('./mod')
                const staticSideEffectRegex = /^import\s+(['"])(.+?)\1;?$/
                const staticMatch = trimmedStatement.match(
                    staticSideEffectRegex,
                )
                if (staticMatch) {
                    hasChanged = true
                    const modulePath = `${staticMatch[1]}${staticMatch[2]}${staticMatch[1]}`
                    return `\nrequire(${modulePath});`
                }

                // import('./mod') -> require('./mod')
                // await import('./mod') -> require('./mod')
                const dynamicSideEffectRegex =
                    /^(?:await\s+)?import\((['"])(.+?)\1\);?$/
                const dynamicMatch = trimmedStatement.match(
                    dynamicSideEffectRegex,
                )
                if (dynamicMatch) {
                    hasChanged = true
                    const modulePath = `${dynamicMatch[1]}${dynamicMatch[2]}${dynamicMatch[1]}`
                    return `\nrequire(${modulePath});`
                }

                this.warn(
                    `[${name}] Warning: Could not transform statement in ${id}:\n${statement}\n` +
                        `The line after the comment must be a side-effect import or a dynamic import with .then().`,
                )

                return match
            })

            if (hasChanged)
                return {
                    code: newCode,
                    map: null, // Sourcemaps are broken by this transform
                }

            return null
        },
    } satisfies RolldownPlugin
}
