import watcher from '@parcel/watcher'
import { debounce } from '@revenge-mod/utils/callback'
import chalk from 'chalk'
import { readFile } from 'fs/promises'
import { createServer } from 'http'
import os from 'os'
import { join } from 'path'
import { crc32 } from 'zlib'
import pkg from '../package.json' with { type: 'json' }
import build from './build'

const prod = process.argv.includes('--prod')
const lanHost = process.argv.includes('--lan')

const Port = 4040
const BundlePath = './dist/revenge.bundle'

console.info(chalk.redBright(`\nRevenge ${chalk.white(`v${pkg.version}`)}\n`))

const cwdify = (path: string) => join(process.cwd(), path)
const Sources = [
    'src',
    'lib',
    'plugins',
    'shims',
    'package.json',
    'tsconfig.json',
].map(cwdify)
const ExitTriggers = ['scripts'].map(cwdify)

const debouncedBuild = debounce(
    () => ((needRebuild = false), build(!prod)),
    250,
)

let needRebuild = true

watcher.subscribe(process.cwd(), (err, events) => {
    if (err) return console.error(err)

    if (events.some(it => ExitTriggers.some(se => it.path.startsWith(se)))) {
        console.error(chalk.redBright('\u26A0 Scripts has changed, exiting!'))
        process.exit()
    }

    needRebuild ||= events.some(it =>
        Sources.some(src => it.path.startsWith(src)),
    )
})

const server = createServer(async (req, res) => {
    try {
        if (needRebuild) await debouncedBuild()
        console.debug(
            chalk.gray(
                `\u{1F79B} Receiving request from ${req.socket.remoteAddress}`,
            ),
        )

        const bundle = await readFile(BundlePath).catch(() => null)
        if (!bundle)
            throw new Error('Could not serve the bundle! No file found.')

        const hash = crc32(bundle).toString(16)

        if (req.headers['if-none-match'] === hash) {
            console.debug(
                chalk.gray('\u{1F4BE} ETag matched, responding with 304'),
            )

            res.writeHead(304)
            res.end()
            return
        }

        res.writeHead(200, {
            ETag: hash,
            'Content-Length': bundle.byteLength,
        })
        res.end(bundle)
    } catch (e) {
        console.error(e)

        res.writeHead(500)
        res.end('Build failed. Check console for details.')
    }
})

server.listen(Port, lanHost ? '0.0.0.0' : '127.0.0.1')

if (lanHost) console.info(chalk.gray('\u24D8 Listening on all interfaces...'))
else
    console.info(
        chalk.gray(
            '\u24D8 Listening locally... Use --lan to listen on all interfaces',
        ),
    )

if (!prod) console.info(chalk.gray('\u24D8 Use --prod to build for production'))
else console.info(chalk.gray('\u24D8 Building for production...'))

console.info(chalk.cyanBright(`\u24D8 Serving on port ${Port}`))
console.info(chalk.gray('\u24D8 Accessible on:'))

for (const int of Object.values(os.networkInterfaces()))
    if (int)
        for (const det of int) {
            if (det.family !== 'IPv4' || (!det.internal && !lanHost)) continue
            console.info(chalk.gray(`- http://${det.address}:${Port}`))
        }
