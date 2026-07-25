import { isPluginEnabled, pEmitter, pList } from '@revenge-mod/plugins/_'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { AnyPlugin } from '@revenge-mod/plugins/_'
import type { ReactNode } from 'react'

export interface PluginEnabledStates {
    [pluginId: string]: boolean
}

const PluginStatesContext = createContext<{
    enabled: PluginEnabledStates
    status: { [pluginId: string]: number }
} | null>(null)

export default function PluginStatesProvider({
    children,
}: {
    children: ReactNode
}) {
    const [enabled, setEnabled] = useState<PluginEnabledStates>(() => {
        const states: PluginEnabledStates = {}
        for (const plugin of pList.values()) {
            states[plugin.manifest.id] = isPluginEnabled(plugin)
        }
        return states
    })

    const [status, setStatus] = useState<{ [pluginId: string]: number }>(() => {
        const statuses: { [pluginId: string]: number } = {}
        for (const plugin of pList.values()) {
            statuses[plugin.manifest.id] = plugin.status
        }
        return statuses
    })

    useEffect(() => {
        const handleStatusChange = (plugin: AnyPlugin) => {
            setStatus(prev => ({
                ...prev,
                [plugin.manifest.id]: plugin.status,
            }))
        }

        const handleEnabled = (plugin: AnyPlugin) => {
            setEnabled(prev => ({
                ...prev,
                [plugin.manifest.id]: true,
            }))
        }

        const handleDisabled = (plugin: AnyPlugin) => {
            setEnabled(prev => ({
                ...prev,
                [plugin.manifest.id]: false,
            }))
        }

        pEmitter.on('preInited', handleStatusChange)
        pEmitter.on('inited', handleStatusChange)
        pEmitter.on('started', handleStatusChange)
        pEmitter.on('stopped', handleStatusChange)

        pEmitter.on('enabled', handleEnabled)
        pEmitter.on('disabled', handleDisabled)

        return () => {
            pEmitter.off('preInited', handleStatusChange)
            pEmitter.off('inited', handleStatusChange)
            pEmitter.off('started', handleStatusChange)
            pEmitter.off('stopped', handleStatusChange)

            pEmitter.off('enabled', handleEnabled)
            pEmitter.off('disabled', handleDisabled)
        }
    }, [])

    const contextValue = useMemo(
        () => ({
            enabled,
            status,
        }),
        [enabled, status],
    )

    return (
        <PluginStatesContext.Provider value={contextValue}>
            {children}
        </PluginStatesContext.Provider>
    )
}

export function usePluginEnabled(plugin: AnyPlugin) {
    const context = useContext(PluginStatesContext)

    if (!context) {
        console.warn('usePluginEnabled not used within a PluginStateProvider')
        return isPluginEnabled(plugin)
    }

    return context.enabled[plugin.manifest.id]
}

export function usePluginStatus(plugin: AnyPlugin) {
    const context = useContext(PluginStatesContext)

    if (!context) {
        console.warn('usePluginStatus not used within a PluginStateProvider')
        return plugin.status
    }

    return context.status[plugin.manifest.id]
}
