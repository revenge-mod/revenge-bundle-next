import { Design } from '@revenge-mod/discord/design'
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    ClickOutsideProvider,
    useClickOutside,
} from 'react-native-click-outside'
import type { View } from 'react-native'

const { useTooltip } = Design

export const PluginTooltip = {
    /** Shown when an action requires the plugin to be enabled first. */
    Enable: 'enable',
    /** Shown when an action is blocked because the plugin is essential. */
    Essential: 'essential',
    /** Shown when an action is blocked because the plugin has a pending update. */
    PendingUpdate: 'pendingUpdate',
} as const

export type PluginTooltip = (typeof PluginTooltip)[keyof typeof PluginTooltip]

const Labels: Record<PluginTooltip, string> = {
    [PluginTooltip.Enable]: 'Plugin must be enabled first',
    [PluginTooltip.Essential]: 'Plugin needed for Revenge to function properly',
    [PluginTooltip.PendingUpdate]:
        'Plugin has a pending update, reload to apply it',
}

interface PluginTooltipsContextValue {
    show: (tooltip: PluginTooltip, target: View | null) => void
    hide: () => void
}

const PluginTooltipsContext = createContext<PluginTooltipsContextValue | null>(
    null,
)

export default function PluginTooltipsProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [visible, setVisible] = useState<PluginTooltip | null>(null)

    // Targets are assigned by `show`, right before the tooltip becomes visible
    const enableTarget = useRef<View | null>(null)
    const essentialTarget = useRef<View | null>(null)
    const pendingUpdateTarget = useRef<View | null>(null)

    useTooltip(enableTarget, {
        label: Labels[PluginTooltip.Enable],
        position: 'top',
        visible: visible === PluginTooltip.Enable,
    })

    useTooltip(essentialTarget, {
        label: Labels[PluginTooltip.Essential],
        position: 'top',
        visible: visible === PluginTooltip.Essential,
    })

    useTooltip(pendingUpdateTarget, {
        label: Labels[PluginTooltip.PendingUpdate],
        position: 'top',
        visible: visible === PluginTooltip.PendingUpdate,
    })

    const value = useMemo<PluginTooltipsContextValue>(() => {
        const targets = {
            [PluginTooltip.Enable]: enableTarget,
            [PluginTooltip.Essential]: essentialTarget,
            [PluginTooltip.PendingUpdate]: pendingUpdateTarget,
        }

        return {
            show: (tooltip, target) => {
                targets[tooltip].current = target
                setVisible(tooltip)
            },
            hide: () => setVisible(null),
        }
    }, [])

    return (
        <ClickOutsideProvider>
            <PluginTooltipsContext.Provider value={value}>
                {children}
            </PluginTooltipsContext.Provider>
        </ClickOutsideProvider>
    )
}

/**
 * Binds an element to a plugin tooltip.
 *
 * @param tooltip The tooltip to show for the element.
 * @returns The ref to attach to the element, and a callback showing the tooltip on it.
 */
export function usePluginTooltip(tooltip: PluginTooltip) {
    const context = useContext(PluginTooltipsContext)
    if (!context)
        throw new Error(
            'usePluginTooltip must be used within PluginTooltipsProvider',
        )

    const { show, hide } = context

    // Tapping anywhere else dismisses the tooltip
    const ref = useClickOutside<View>(hide)

    const showTooltip = useCallback(() => {
        // Tapping the element itself also counts as a tap outside of it (the
        // press target wraps the ref), so showing waits for the next frame
        requestAnimationFrame(() => {
            show(tooltip, ref.current)
        })
    }, [show, tooltip, ref])

    return [ref, showTooltip] as const
}

/** Hides the visible plugin tooltip, if any.. */
export function useHidePluginTooltips() {
    const context = useContext(PluginTooltipsContext)

    return useCallback(() => context?.hide(), [context])
}
