import { Design } from '@revenge-mod/discord/design'
import { createContext, useContext, useRef, useState } from 'react'
import { useClickOutside } from 'react-native-click-outside'
import type { RefObject } from 'react'
import type { View } from 'react-native'

const { useTooltip } = Design

interface TooltipContextValue {
    targetRef: RefObject<View | null>
    setVisible: (visible: boolean) => void
}

const EnablePluginTooltipContext = createContext<TooltipContextValue | null>(
    null,
)
const EssentialPluginTooltipContext = createContext<TooltipContextValue | null>(
    null,
)

export function EnablePluginTooltipProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [visible, setVisible] = useState(false)
    const targetRef = useRef<View | null>(null)

    useTooltip(targetRef, {
        label: 'Plugin must be enabled first',
        position: 'top',
        visible,
    })

    return (
        <EnablePluginTooltipContext.Provider value={{ targetRef, setVisible }}>
            {children}
        </EnablePluginTooltipContext.Provider>
    )
}

export function EssentialPluginTooltipProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [visible, setVisible] = useState(false)
    const targetRef = useRef<View | null>(null)

    useTooltip(targetRef, {
        label: 'Plugin needed for Revenge to function properly',
        position: 'top',
        visible,
    })

    return (
        <EssentialPluginTooltipContext.Provider
            value={{ targetRef, setVisible }}
        >
            {children}
        </EssentialPluginTooltipContext.Provider>
    )
}

export function useEnablePluginTooltip() {
    const context = useContext(EnablePluginTooltipContext)
    if (!context) {
        throw new Error(
            'useEnablePluginTooltip must be used within EnablePluginTooltipProvider',
        )
    }
    return context
}

export function useEssentialPluginTooltip() {
    const context = useContext(EssentialPluginTooltipContext)
    if (!context) {
        throw new Error(
            'useEssentialPluginTooltip must be used within EssentialPluginTooltipProvider',
        )
    }
    return context
}

export function useResetTooltips() {
    const enableTooltip = useContext(EnablePluginTooltipContext)
    const essentialTooltip = useContext(EssentialPluginTooltipContext)

    return () => {
        enableTooltip?.setVisible(false)
        essentialTooltip?.setVisible(false)
    }
}

export function useClickOutsideTooltip(
    contextHook: () => TooltipContextValue,
    onClickOutside: () => void,
) {
    const { targetRef, setVisible } = contextHook()

    const ref = useClickOutside<View>(() => {
        setVisible(false)
        if (targetRef.current === ref.current) {
            onClickOutside()
        }
    })

    return ref
}
