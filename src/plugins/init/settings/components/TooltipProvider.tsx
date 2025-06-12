/*
    Only one tooltip can be visible at a time, so we use a global state to control the visibility of the tooltip.
    Why? Because we don't want to run useTooltip on every single plugin card. This is ugly, but it works.
*/

import { Design } from '@revenge-mod/discord/design'
import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { View } from 'react-native'

const { useTooltip } = Design

export let setEnablePluginTooltipVisible: ((v: boolean) => void) | undefined
export const enableTooltipTarget: MutableRefObject<View | null> = {
    current: null,
}

export function EnablePluginTooltipProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        setEnablePluginTooltipVisible = setVisible
        return () => {
            enableTooltipTarget.current = null
            setEnablePluginTooltipVisible = undefined
        }
    }, [])

    useTooltip(enableTooltipTarget, {
        label: 'Plugin must be enabled first',
        position: 'top',
        visible,
    })

    return children
}

export let setEssentialPluginTooltipVisible: ((v: boolean) => void) | undefined
export const essentialTooltipTarget: MutableRefObject<View | null> = {
    current: null,
}

export function EssentialPluginTooltipProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        setEssentialPluginTooltipVisible = setVisible
        return () => {
            essentialTooltipTarget.current = null
            setEssentialPluginTooltipVisible = undefined
        }
    }, [])

    useTooltip(essentialTooltipTarget, {
        label: 'Plugin needed for Revenge to function properly',
        position: 'top',
        visible,
    })

    return children
}

export function resetTooltips() {
    setEnablePluginTooltipVisible?.(false)
    setEssentialPluginTooltipVisible?.(false)
}
