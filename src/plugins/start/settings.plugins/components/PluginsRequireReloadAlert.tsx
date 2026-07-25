import { Design } from '@revenge-mod/discord/design'
import { BundleUpdaterManager } from '@revenge-mod/discord/native'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const { AlertModal, AlertActionButton, Text } = Design

export default function PluginsRequireReloadAlert({
    plugins,
}: {
    plugins: AnyPlugin[]
}) {
    return (
        <AlertModal
            title="Reload Required"
            content={
                <Text variant="text-md/medium" color="text-default">
                    The following plugins require a reload to apply changes:
                    {'\n'}
                    {plugins.map((plugin, index) => (
                        <>
                            {index ? ', ' : null}
                            <Text
                                key={plugin.manifest.id}
                                variant="text-md/bold"
                                color="text-default"
                            >
                                {plugin.manifest.name}
                            </Text>
                        </>
                    ))}
                </Text>
            }
            actions={
                <>
                    <AlertActionButton
                        variant="destructive"
                        text="Reload"
                        onPress={() => {
                            // TODO: Replace with bridge call
                            BundleUpdaterManager.reload()
                        }}
                    />
                    <AlertActionButton variant="secondary" text="Not now" />
                </>
            }
        />
    )
}
