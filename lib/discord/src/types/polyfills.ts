/**
 * Namespace import, as bundling types changes the named import back to `Buffer`,
 * which makes the global reference itself.
 */
import type * as NodeBuffer from 'buffer'

declare global {
    var Buffer: typeof NodeBuffer.Buffer
}
