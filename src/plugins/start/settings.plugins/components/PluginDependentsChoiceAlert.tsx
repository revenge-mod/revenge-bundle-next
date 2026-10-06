import Checkbox from '@revenge-mod/components/Checkbox'
import { Design } from '@revenge-mod/discord/design'
import { useCallback, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useAlertBodyHeight } from '../utils/dialogs'
import { PLUGIN_CARD_ESTIMATED_SIZE } from './PluginCard'
import { PluginFlashList, pluginCardDataOf } from './PluginList'
import type { AnyPlugin } from '@revenge-mod/plugins/_'
import type { PluginCardData, PluginCardExtras } from './PluginList'

const { AlertModal, AlertActionButton } = Design

/** Asks what should happen to the plugins affected by an action. */
export default function PluginDependentsChoiceAlert({
    title,
    content,
    confirmText,
    cancelText = 'Cancel',
    confirmVariant = 'destructive',
    toggleLabel,
    locked,
    selectable,
    defaultSelected = true,
    action,
}: {
    title: string
    content: React.ReactNode
    confirmText: string
    cancelText?: string
    confirmVariant?: 'destructive' | 'primary'
    /** Rendered next to each selectable plugin, eg. "Keep running". */
    toggleLabel: string
    /** Plugins that cannot be modified. */
    locked: AnyPlugin[]
    /** Plugins that can be modified. */
    selectable: AnyPlugin[]
    /** Default selection value for {@link selectable}s. */
    defaultSelected?: boolean
    action: (selected: Set<string>) => Promise<void>
}) {
    const { available, bodyRef, onLayout, actionsEnd } = useAlertBodyHeight()

    const plugins = useMemo(
        () => [...locked, ...selectable].map(pluginCardDataOf),
        [locked, selectable],
    )
    const [height, setHeight] = useState(
        PLUGIN_CARD_ESTIMATED_SIZE * plugins.length,
    )

    const [selected, setSelected] = useState(
        () =>
            new Set(
                defaultSelected
                    ? selectable.map(p => p.manifest.id)
                    : undefined,
            ),
    )

    const isSelectable = useCallback(
        (id: string) => selectable.some(p => p.manifest.id === id),
        [selectable],
    )

    const toggle = useCallback((id: string, on: boolean) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (on) next.add(id)
            else next.delete(id)
            return next
        })
    }, [])

    const extrasOf = useCallback(
        ({ id }: PluginCardData): PluginCardExtras => ({
            actions: (
                <Checkbox
                    aria-label={toggleLabel}
                    disabled={!isSelectable(id)}
                    checked={selected.has(id)}
                    onToggle={on => toggle(id, on)}
                />
            ),
            onPress: isSelectable(id)
                ? () => toggle(id, !selected.has(id))
                : undefined,
            accessibilityHint: `Toggles "${toggleLabel}"`,
        }),
        [isSelectable, selected, toggleLabel, toggle],
    )

    return (
        <AlertModal
            title={title}
            content={content}
            extraContent={
                <View
                    ref={bodyRef}
                    onLayout={onLayout}
                    style={{ height: Math.min(height, available) }}
                >
                    <PluginFlashList
                        plugins={plugins}
                        onContentSizeChange={(_, h) => setHeight(h)}
                        extrasOf={extrasOf}
                    />
                </View>
            }
            actions={
                <>
                    <AlertActionButton
                        text={confirmText}
                        variant={confirmVariant}
                        onPress={() => action(selected)}
                    />
                    <AlertActionButton text={cancelText} variant="secondary" />
                    {actionsEnd}
                </>
            }
        />
    )
}
