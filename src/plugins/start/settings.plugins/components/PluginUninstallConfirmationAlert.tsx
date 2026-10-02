import { Design } from '@revenge-mod/discord/design'
import {
    getInternalPluginMeta,
    hasPluginStub,
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
                updates ? (
                    <Text color="text-default">
                        The built-in version of{' '}
                        <Text variant="text-md/semibold" color="text-default">
                            {plugin.manifest.name}
                        </Text>{' '}
                        will be restored. All of its data will be removed. This
                        cannot be undone.
                    </Text>
                ) : (
                    <Text color="text-default">
                        <Text variant="text-md/semibold" color="text-default">
                            {plugin.manifest.name}
                        </Text>{' '}
                        and all of its data will be removed. This cannot be
                        undone.
                    </Text>
                )
            }
            extraContent={
                reloadPending && (
                    <Text
                        variant="text-md/semibold"
                        color="text-feedback-critical"
                    >
                        This plugin is pending a reload. Uninstalling now may
                        leave unintended side effects.
                    </Text>
                )
            }
            actions={
                <>
                    <AlertActionButton
                        onPress={action}
                        text={updates ? 'Uninstall updates' : 'Uninstall'}
                        variant="destructive"
                    />
                    <AlertActionButton text="Cancel" variant="secondary" />
                </>
            }
        />
    )
}
