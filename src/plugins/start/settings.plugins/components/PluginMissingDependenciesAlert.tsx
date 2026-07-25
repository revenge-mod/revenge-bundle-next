import { Design } from '@revenge-mod/discord/design'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const { AlertModal, AlertActionButton, Text, TableRowGroup, TableRow } = Design

export default function PluginMissingDependenciesAlert({
    plugin,
    dependencies,
    action,
}: {
    plugin: AnyPlugin
    /** The missing required dependencies: id + the declared version range. */
    dependencies: { id: string; range: string }[]
    action: () => unknown
}) {
    return (
        <AlertModal
            title="Plugin has missing dependencies"
            content={
                <Text color="text-default">
                    Plugin{' '}
                    <Text variant="text-md/semibold" color="text-default">
                        {plugin.manifest.name}
                    </Text>{' '}
                    requires plugins that are not installed. Install them from
                    your repositories to enable it.
                </Text>
            }
            extraContent={
                <TableRowGroup>
                    {dependencies.map(dep => (
                        <TableRow
                            key={dep.id}
                            label={dep.id}
                            subLabel={`Requires version ${dep.range}`}
                        />
                    ))}
                </TableRowGroup>
            }
            actions={
                <>
                    <AlertActionButton
                        text="Install"
                        variant="primary"
                        onPress={action}
                    />
                    <AlertActionButton text="Cancel" variant="secondary" />
                </>
            }
        />
    )
}
