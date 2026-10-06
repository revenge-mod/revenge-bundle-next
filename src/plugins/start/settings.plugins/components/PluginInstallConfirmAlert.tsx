import Checkbox from '@revenge-mod/components/Checkbox'
import { Design } from '@revenge-mod/discord/design'
import { confirmInstallFile } from '@revenge-mod/plugins/_'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useAlertBodyHeight } from '../utils/dialogs'
import { PLUGIN_CARD_ESTIMATED_SIZE } from './PluginCard'
import { PluginFlashList } from './PluginList'
import type { PluginInstallReadyEvent } from '@revenge-mod/plugins/_'
import type { ReactNode } from 'react'
import type { PluginCardData } from './PluginList'

const { AlertModal, AlertActionButton, Text } = Design

export interface PluginInstallConfirmItem extends PluginCardData {
    /** Listed dependents. Empty for requested plugins. */
    dependents?: { id: string; optional: boolean }[]
}

/** Lists plugins to install, with skippable optional dependencies. */
export default function PluginInstallConfirmAlert({
    title,
    content,
    extraContent,
    items,
    page,
    busy,
    onConfirm,
    onCancel,
}: {
    title: string
    content?: string
    /** Shown above the list. */
    extraContent?: ReactNode
    items: PluginInstallConfirmItem[]
    /** Replaces the list. */
    page?: ReactNode
    /** Disables installing. */
    busy?: boolean
    onConfirm: (ids: Set<string>) => void
    onCancel: () => void
}) {
    const { available, bodyRef, onLayout, actionsEnd } = useAlertBodyHeight()
    const [listHeight, setListHeight] = useState(
        PLUGIN_CARD_ESTIMATED_SIZE * items.length,
    )

    const [skipped, setSkipped] = useState<Set<string>>(() => new Set())
    const included = useMemo(
        () => resolveIncluded(items, skipped),
        [items, skipped],
    )
    // Excluded plugins show no source
    const listed = useMemo(
        () =>
            items.map(item =>
                included.has(item.id)
                    ? item
                    : {
                          ...item,
                          size: undefined,
                          version: undefined,
                          repository: undefined,
                          onPressVersion: undefined,
                          onPressRepository: undefined,
                      },
            ),
        [items, included],
    )
    const selectable = items.some(item => isSkippable(item, included))

    const toggle = (id: string, on: boolean) =>
        setSkipped(prev => {
            const next = new Set(prev)
            if (on) next.delete(id)
            else next.add(id)
            return next
        })

    return (
        <AlertModal
            title={title}
            content={content}
            extraContent={
                <>
                    {extraContent}
                    <View
                        ref={bodyRef}
                        onLayout={onLayout}
                        style={{
                            height: page
                                ? available
                                : Math.min(listHeight, available),
                        }}
                    >
                        {page ?? (
                            <PluginFlashList
                                plugins={listed}
                                onContentSizeChange={(_, h) => setListHeight(h)}
                                extrasOf={item => ({
                                    actions: selectable && (
                                        <Checkbox
                                            aria-label="Install"
                                            checked={included.has(item.id)}
                                            disabled={
                                                !isSkippable(item, included)
                                            }
                                            onToggle={on => toggle(item.id, on)}
                                        />
                                    ),
                                    onPress: isSkippable(item, included)
                                        ? () =>
                                              toggle(
                                                  item.id,
                                                  !included.has(item.id),
                                              )
                                        : undefined,
                                    accessibilityHint:
                                        'Toggles installing this plugin',
                                })}
                            />
                        )}
                    </View>
                </>
            }
            actions={
                <>
                    <AlertActionButton
                        text="Install"
                        variant="primary"
                        loading={busy}
                        disabled={busy}
                        onPress={() => onConfirm(included)}
                    />
                    <AlertActionButton
                        text="Cancel"
                        variant="secondary"
                        onPress={onCancel}
                    />
                    {actionsEnd}
                </>
            }
        />
    )
}

/** Confirms installing a plugin from a file. */
export function PluginFileInstallConfirmAlert({
    prompt,
}: {
    prompt: PluginInstallReadyEvent
}) {
    const { manifest, replaces } = prompt

    return (
        <PluginInstallConfirmAlert
            title={`Install ${manifest.name}?`}
            extraContent={
                replaces != null && (
                    <Text
                        variant="text-md/medium"
                        color="text-feedback-warning"
                    >
                        This replaces the installed version {replaces}. The
                        update applies after a reload.
                    </Text>
                )
            }
            items={[
                {
                    id: manifest.id,
                    name: manifest.name,
                    description: manifest.description,
                    icon: manifest.icon ?? undefined,
                    version:
                        replaces != null
                            ? `v${replaces} \u2192 v${manifest.version}`
                            : `v${manifest.version}`,
                },
            ]}
            onConfirm={() => confirmInstallFile(prompt.token, true)}
            onCancel={() => confirmInstallFile(prompt.token, false)}
        />
    )
}

/** Resolves plugins to install: requested and dependencies of included ones unless skipped. */
function resolveIncluded(
    items: PluginInstallConfirmItem[],
    skipped: Set<string>,
) {
    const included = new Set(
        items.filter(item => !item.dependents?.length).map(item => item.id),
    )

    let changed = true
    while (changed) {
        changed = false

        for (const item of items) {
            if (included.has(item.id)) continue

            const pulled = item.dependents!.some(
                d =>
                    included.has(d.id) && !(d.optional && skipped.has(item.id)),
            )

            if (pulled) {
                included.add(item.id)
                changed = true
            }
        }
    }

    return included
}

/** Whether all included plugins depend on it optionally. */
function isSkippable(item: PluginInstallConfirmItem, included: Set<string>) {
    const dependents = item.dependents?.filter(d => included.has(d.id))
    return Boolean(dependents?.length) && dependents!.every(d => d.optional)
}
