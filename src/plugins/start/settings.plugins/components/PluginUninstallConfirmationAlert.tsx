import { Design } from '@revenge-mod/discord/design'
import {
    getInternalPluginMeta,
    hasPluginStub,
    isPluginPendingReload,
    isPluginPendingUpdate,
} from '@revenge-mod/plugins/_'
import { useState } from 'react'
import { View } from 'react-native'
import { useAlertBodyHeight } from '../utils/dialogs'
import { PLUGIN_CARD_ESTIMATED_SIZE } from './PluginCard'
import { PluginFlashList, pluginCardDataOf } from './PluginList'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const { AlertModal, AlertActionButton, Text } = Design

export default function PluginUninstallConfirmationAlert({
    plugin,
    dependencies,
    action,
}: {
    plugin: AnyPlugin
    /** Plugins that will be disabled by uninstalling this plugin. */
    dependencies: AnyPlugin[]
    action: () => Promise<void>
}) {
    const { available, bodyRef, onLayout, actionsEnd } = useAlertBodyHeight()
    const [height, setHeight] = useState(
        PLUGIN_CARD_ESTIMATED_SIZE * dependencies.length,
    )

    const reloadPending =
        isPluginPendingReload(plugin) || isPluginPendingUpdate(plugin)
    // Uninstalling updates restores the built-in version
    const updates = hasPluginStub(getInternalPluginMeta(plugin))

    return (
        <AlertModal
            title={
                updates
                    ? `Uninstall updates for ${plugin.manifest.name}?`
                    : `Uninstall ${plugin.manifest.name}?`
            }
            content={
                <Text color="text-default">
                    {updates ? (
                        <>
                            The built-in version of{' '}
                            <Text
                                variant="text-md/semibold"
                                color="text-default"
                            >
                                {plugin.manifest.name}
                            </Text>{' '}
                            will be restored. All of its data will be removed.
                            This cannot be undone.
                        </>
                    ) : (
                        <>
                            <Text
                                variant="text-md/semibold"
                                color="text-default"
                            >
                                {plugin.manifest.name}
                            </Text>{' '}
                            and all of its data will be removed. This cannot be
                            undone.
                        </>
                    )}
                </Text>
            }
            extraContent={
                <>
                    {reloadPending && (
                        <Text
                            variant="text-md/semibold"
                            color="text-feedback-critical"
                        >
                            This plugin is pending a reload. Uninstalling now
                            may leave unintended side effects.
                        </Text>
                    )}
                    {dependencies.length > 0 && (
                        <>
                            <Text
                                variant="text-md/semibold"
                                color="text-feedback-warning"
                            >
                                These plugins need {plugin.manifest.name}, so
                                they will be disabled:
                            </Text>
                            <View
                                ref={bodyRef}
                                onLayout={onLayout}
                                style={{ height: Math.min(height, available) }}
                            >
                                <PluginFlashList
                                    plugins={dependencies.map(pluginCardDataOf)}
                                    onContentSizeChange={(_, h) => setHeight(h)}
                                />
                            </View>
                        </>
                    )}
                </>
            }
            actions={
                <>
                    <AlertActionButton
                        onPress={action}
                        text={updates ? 'Uninstall updates' : 'Uninstall'}
                        variant="destructive"
                    />
                    <AlertActionButton text="Cancel" variant="secondary" />
                    {actionsEnd}
                </>
            }
        />
    )
}
