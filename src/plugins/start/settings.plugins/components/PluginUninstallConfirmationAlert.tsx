import { Design } from '@revenge-mod/discord/design'
import {
    isPluginPendingReload,
    isPluginPendingUpdate,
} from '@revenge-mod/plugins/_'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const { AlertModal, AlertActionButton, Text } = Design

export default function PluginUninstallConfirmationAlert({
    plugin,
    action,
}: {
    plugin: AnyPlugin
    action: () => Promise<void>
}) {
    const reloadPending =
        isPluginPendingReload(plugin) || isPluginPendingUpdate(plugin)

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
            extraContent={
                reloadPending && (
                    <Text
                        variant="text-md/semibold"
                        color="text-feedback-critical"
                    >
                        This plugin is pending a reload. Uninstalling now may
                        leave side unintended effects.
                    </Text>
                )
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
