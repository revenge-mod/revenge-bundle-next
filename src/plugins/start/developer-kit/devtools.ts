import { DevToolsClient } from '@revenge-mod/devtools-client'
import { LogLevel } from '@revenge-mod/devtools-shared/constants'
import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { TypedEventEmitter } from '@revenge-mod/discord/common/utils'
import { ClientInfoModule } from '@revenge-mod/discord/native'
import { getBridgeInfo } from '@revenge-mod/modules/native'
import { instead } from '@revenge-mod/patcher'
import { noop } from '@revenge-mod/utils/callback'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { useReRender } from '@revenge-mod/utils/react'
import { useEffect } from 'react'
import { api } from '.'
import type { UnpatchFunction } from '@revenge-mod/patcher/types'

export const DTContext: {
    client: DevToolsClient | null
    addr: string
    con: boolean
} = {
    client: null,
    addr: 'localhost:7684',
    con: false,
}

const events = new TypedEventEmitter<{
    connect: []
    disconnect: []
    errored: [unknown]
}>()

const CircleErrorIcon = lookupGeneratedIconComponent(
    'CircleErrorIcon',
    'CircleErrorIcon-secondary',
    'CircleErrorIcon-primary',
)

let intercepted = false

function interceptLogging() {
    if (intercepted) return noop

    intercepted = true
    const unpatches: UnpatchFunction[] = []

    for (const [key, level] of [
        ['log', LogLevel.Default],
        ['warn', LogLevel.Warn],
        ['error', LogLevel.Error],
        ['info', LogLevel.Default],
        ['debug', LogLevel.Debug],
    ] as const) {
        unpatches.push(
            instead(console, key, (args, orig) => {
                if (DTContext.con && DTContext.client)
                    DTContext.client.log(level, args)
                return Reflect.apply(orig, console, args)
            }),
        )
    }

    return () => {
        intercepted = false
        for (const unpatch of unpatches) unpatch()
    }
}

export function connect() {
    const Bridge = getBridgeInfo()
    const Client = ClientInfoModule.getConstants()

    const client = (DTContext.client = new DevToolsClient())
    client.expose('api', api)
    client.expose('cleanup', api.cleanup)
    client.expose('logger', api.logger)
    client.expose('revenge', api.unscoped)

    client.connect(
        `ws://${DTContext.addr}`,
        `${Client.Version}${Bridge ? ` (${Bridge.name} ${Bridge.version})` : ''}`,
    )

    const ws = client.ws!

    ws.addEventListener('open', () => {
        if (client.settings.log.interceptConsole) {
            const unintercept = interceptLogging()

            ws.addEventListener('close', function self() {
                unintercept()
                ws.removeEventListener('close', self)
            })
        }

        DTContext.con = true
        events.emit('connect')
    })

    ws.addEventListener('close', e_ => {
        cleanup()
        events.emit('disconnect')

        const e = e_ as CloseEvent
        if (!e.wasClean) {
            api.logger.error('DevTools error:', e.reason)

            ToastActionCreators.open({
                key: 'DEVTOOLS_ERROR',
                IconComponent: CircleErrorIcon,
                content: e.reason,
            })
        }
    })
}

function cleanup() {
    DTContext.client = null
    DTContext.con = false
}

export function disconnect() {
    DTContext.client?.disconnect()
}

export function useIsConnected() {
    const rerender = useReRender()

    useEffect(() => {
        events.on('connect', rerender)
        events.on('disconnect', rerender)

        return () => {
            events.off('connect', rerender)
            events.off('disconnect', rerender)
        }
    }, [rerender])

    return DTContext.con
}
