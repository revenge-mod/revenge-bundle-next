import watcher from '@parcel/watcher'
import { debounce } from '@revenge-mod/utils/callbacks'
import chalk from 'chalk'
import os from 'os'
import { join } from 'path'
import pkg from '../package.json'
import build from './build'

const prod = process.argv.includes('--prod')
const lanHost = process.argv.includes('--lan')

console.info(chalk.redBright(`\nRevenge ${chalk.white(`v${pkg.version}`)}\n`))

const cwdify = (path: string) => join(process.cwd(), path)
const Sources = [
    'src',
    'lib',
    'plugins',
    'shims',
    'package.json',
    'bun.lock',
    'tsconfig.json',
].map(cwdify)
const ExitTriggers = ['scripts'].map(cwdify)

const debouncedBuildDev = debounce(
    () => ((needRebuild = false), build(true)),
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

const server = Bun.serve({
    hostname: lanHost ? '0.0.0.0' : '127.0.0.1',
    async fetch(req, srv) {
        try {
            if (needRebuild) await debouncedBuildDev()
            console.debug(
                chalk.gray(
                    `\u{1F79B} Receiving request from ${srv.requestIP(req)!.address}`,
                ),
            )

            const file = Bun.file('./dist/revenge.bundle')
            if (await file.exists()) return new Response(file)
            else throw new Error('Could not serve the bundle! No file found.')
        } catch (e) {
            console.error(e)
            throw new Error('Build failed. Check console for details.')
        }
    },
    port: 4040,
})

if (lanHost) console.info(chalk.gray('\u24D8 Listening on all interfaces...'))
else
    console.info(
        chalk.gray(
            '\u24D8 Listening locally... Use --lan to listen on all interfaces',
        ),
    )

if (!prod) console.info(chalk.gray('\u24D8 Use --prod to build for production'))
else console.info(chalk.gray('\u24D8 Building for production...'))

console.info(chalk.cyanBright(`\u24D8 Serving on port ${server.port}`))
console.info(chalk.gray('\u24D8 Accessible on:'))

for (const int of Object.values(os.networkInterfaces()))
    if (int)
        for (const det of int) {
            if (det.family !== 'IPv4' || (!det.internal && !lanHost)) continue
            console.info(chalk.gray(`- http://${det.address}:${server.port}`))
        }
