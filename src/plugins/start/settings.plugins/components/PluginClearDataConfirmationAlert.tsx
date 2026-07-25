import { Design } from '@revenge-mod/discord/design'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const { AlertModal, AlertActionButton, Text } = Design

export default function PluginClearDataConfirmationAlert({
    plugin,
    action,
}: {
    plugin: AnyPlugin
    action: () => Promise<void>
}) {
    return (
        <AlertModal
            title="Clear plugin data?"
            content={
                <Text color="text-default">
                    All data, including files and settings for{' '}
                    <Text variant="text-md/semibold" color="text-default">
                        {plugin.manifest.name}
                    </Text>{' '}
                    will be deleted
                </Text>
            }
            actions={
                <>
                    <AlertActionButton
                        onPress={action}
                        text="Clear"
                        variant="destructive"
                    />
                    <AlertActionButton text="Cancel" variant="secondary" />
                </>
            }
        />
    )
}
