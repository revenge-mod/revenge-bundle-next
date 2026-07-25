import { Design } from '@revenge-mod/discord/design'
import { useState } from 'react'
import { PixelRatio, useWindowDimensions, View } from 'react-native'
import { PLUGIN_CARD_ESTIMATED_SIZE } from './PluginCard'
import { PluginFlashList } from './PluginList'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const { AlertModal, AlertActionButton, Text } = Design

export default function PluginHasDependentsAlert({
    plugin,
    dependents,
    action,
}: {
    plugin: AnyPlugin
    dependents: AnyPlugin[]
    action: () => Promise<void>
}) {
    const { height: windowHeight } = useWindowDimensions()
    const maxHeight = PixelRatio.get() * windowHeight * 0.35 - 64
    const [height, setHeight] = useState(
        PLUGIN_CARD_ESTIMATED_SIZE * dependents.length,
    )

    return (
        <AlertModal
            title="Plugin has dependents"
            content={
                <Text color="text-default">
                    Other plugins depend on{' '}
                    <Text variant="text-md/semibold" color="text-default">
                        {plugin.manifest.name}
                    </Text>{' '}
                    to function.
                    {'\n'}
                    Disabling it will also disable the following plugins:
                </Text>
            }
            extraContent={
                <View
                    style={{
                        height,
                        maxHeight,
                    }}
                >
                    <PluginFlashList
                        plugins={dependents}
                        onContentSizeChange={(_, h) => setHeight(h)}
                    />
                </View>
            }
            actions={
                <>
                    <AlertActionButton
                        text="Disable all"
                        variant="destructive"
                        onPress={action}
                    />
                    <AlertActionButton text="Cancel" variant="secondary" />
                </>
            }
        />
    )
}
