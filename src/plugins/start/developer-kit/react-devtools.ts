import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { TypedEventEmitter } from '@revenge-mod/discord/common/utils'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { useReRender } from '@revenge-mod/utils/react'
import { useEffect } from 'react'
import { api } from '.'

export const RDTContext: {
    ws: WebSocket | undefined
    addr: string
    con: boolean
    active: boolean
} = {
    active: Boolean(globalThis.__REACT_DEVTOOLS__),
    ws: undefined,
    addr: 'localhost:8097',
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

export function connect() {
    if (!RDTContext.active || RDTContext.ws) return

    const ws = (RDTContext.ws = new WebSocket(`ws://${RDTContext.addr}`))

    ws.addEventListener('open', () => {
        RDTContext.con = true
        events.emit('connect')
    })

    ws.addEventListener('close', e_ => {
        cleanup()
        events.emit('disconnect')

        const e = e_ as CloseEvent
        if (!e.wasClean) {
            api.logger.error('React DevTools error:', e.reason)

            ToastActionCreators.open({
                key: 'REACT_DEVTOOLS_ERROR',
                IconComponent: CircleErrorIcon,
                content: e.reason,
            })
        }
    })

    __REACT_DEVTOOLS__!.exports.connectToDevTools({
        websocket: ws,
    })
}

function cleanup() {
    RDTContext.con = false
    RDTContext.ws = undefined
}

export function disconnect() {
    if (RDTContext.ws) RDTContext.ws.close()
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

    return RDTContext.con
}
