import Checkbox from '@revenge-mod/components/Checkbox'
import { Design } from '@revenge-mod/discord/design'
import { useCallback, useState } from 'react'
import { PixelRatio, useWindowDimensions, View } from 'react-native'
import { PLUGIN_CARD_ESTIMATED_SIZE } from './PluginCard'
import { PluginFlashList } from './PluginList'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

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
    const { height: windowHeight } = useWindowDimensions()
    const maxHeight = PixelRatio.get() * windowHeight * 0.35 - 64

    const plugins = [...locked, ...selectable]
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

    const actions = useCallback(
        (plugin: AnyPlugin) => {
            const { id } = plugin.manifest
            const disabled = !selectable.includes(plugin)

            return (
                <Checkbox
                    aria-label={toggleLabel}
                    disabled={disabled}
                    checked={selected.has(id)}
                    onToggle={on => {
                        setSelected(prev => {
                            const next = new Set(prev)
                            if (on) next.add(id)
                            else next.delete(id)
                            return next
                        })
                    }}
                />
            )
        },
        [selectable, selected, toggleLabel],
    )

    return (
        <AlertModal
            title={title}
            content={content}
            extraContent={
                <View style={{ height, maxHeight }}>
                    <PluginFlashList
                        plugins={plugins}
                        onContentSizeChange={(_, h) => setHeight(h)}
                        actions={actions}
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
                </>
            }
        />
    )
}
