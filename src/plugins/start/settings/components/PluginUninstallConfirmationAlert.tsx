import { Design } from '@revenge-mod/discord/design'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const { AlertModal, AlertActionButton, Text } = Design

export default function PluginUninstallConfirmationAlert({
    plugin,
    action,
}: {
    plugin: AnyPlugin
    action: () => Promise<void>
}) {
    return (
        <AlertModal
            title="Uninstall plugin?"
            content={
                <Text color="text-default">
                    <Text variant="text-md/semibold" color="text-default">
                        {plugin.manifest.name}
                    </Text>{' '}
                    and all of its data will be removed. This cannot be undone.
                </Text>
            }
            actions={
                <>
                    <AlertActionButton
                        onPress={action}
                        text="Uninstall"
                        variant="destructive"
                    />
                    <AlertActionButton text="Cancel" variant="secondary" />
                </>
            }
        />
    )
}
