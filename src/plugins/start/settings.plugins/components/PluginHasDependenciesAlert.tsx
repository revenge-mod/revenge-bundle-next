import { Design } from '@revenge-mod/discord/design'
import { useState } from 'react'
import { View } from 'react-native'
import { useAlertBodyHeight } from '../utils/dialogs'
import { PLUGIN_CARD_ESTIMATED_SIZE } from './PluginCard'
import { PluginFlashList, pluginCardDataOf } from './PluginList'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const { AlertModal, AlertActionButton, Text } = Design

export default function PluginHasDependenciesAlert({
    plugin,
    dependencies,
    action,
}: {
    plugin: AnyPlugin
    dependencies: AnyPlugin[]
    action: () => Promise<void>
}) {
    const { available, bodyRef, onLayout, actionsEnd } = useAlertBodyHeight()
    const [height, setHeight] = useState(
        PLUGIN_CARD_ESTIMATED_SIZE * dependencies.length,
    )

    return (
        <AlertModal
            title="Plugin needs other plugins"
            content={
                <Text color="text-default">
                    Plugin{' '}
                    <Text variant="text-md/semibold" color="text-default">
                        {plugin.manifest.name}
                    </Text>{' '}
                    depends on {dependencies.length} other plugins to function.
                    Continuing will also enable these plugins:
                </Text>
            }
            extraContent={
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
            }
            actions={
                <>
                    <AlertActionButton
                        onPress={action}
                        text="Enable all"
                        variant="primary"
                    />
                    <AlertActionButton text="Cancel" variant="secondary" />
                    {actionsEnd}
                </>
            }
        />
    )
}
