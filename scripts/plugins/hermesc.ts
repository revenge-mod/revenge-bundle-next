import { existsSync, readFileSync } from 'fs'
import type { OutputChunk, RolldownPlugin } from 'rolldown'

export default function hermesCPlugin({
    after,
    before,
    flags,
}: {
    flags?: string[]
    before?: (v: string) => void
    after?: (v: string) => void
} = {}): RolldownPlugin {
    const paths = {
        win32: 'win64-bin/hermesc.exe',
        darwin: 'osx-bin/hermesc',
        linux: 'linux64-bin/hermesc',
    }

    if (!(process.platform in paths))
        throw new Error(`Unsupported platform: ${process.platform}`)

    const sdksDir = './node_modules/react-native/sdks'
    const binPath = `${sdksDir}/hermesc/${paths[process.platform as keyof typeof paths]}`

    if (!existsSync(binPath))
        throw new Error(
            `Hermes compiler not found at ${binPath}. Please ensure you have react-native installed.`,
        )

    const ver = readFileSync(`${sdksDir}/.hermesversion`).toString()

    return {
        name: 'hermesc',
        generateBundle(_, bundle) {
            if (before) before(ver)

            const file = bundle['revenge.js'] as OutputChunk
            if (!file) throw new Error('No code to compile')

            // TODO(scripts/build): Remove this when we have a better way to add sourceURL
            file.code += `//# sourceURL=Revenge`

            const cmdlist = [binPath, '-emit-binary', ...(flags ?? [])]

            const cmd = Bun.spawnSync<'pipe', 'pipe'>(cmdlist, {
                // @ts-expect-error: Types are incorrect, but this works
                stdin: new Blob([file.code]),
                stdout: 'pipe',
            })

            if (cmd.exitCode) {
                if (cmd.stderr.length)
                    throw new Error(
                        `Got error from hermesc: ${cmd.stderr.toString()}`,
                    )
                else
                    throw new Error(`hermesc exited with code: ${cmd.exitCode}`)
            }

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

            if (after) after(ver)
        },
    }
}
