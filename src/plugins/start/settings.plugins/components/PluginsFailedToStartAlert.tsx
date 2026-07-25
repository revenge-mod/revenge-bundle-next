import { Design } from '@revenge-mod/discord/design'
import { RootNavigationRef } from '@revenge-mod/discord/modules/main_tabs_v2'
import { RouteNames } from '../constants'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const { AlertModal, AlertActionButton, Text } = Design

export default function PluginsFailedToStartAlert({
    plugins,
}: {
    plugins: AnyPlugin[]
}) {
    const navigation = RootNavigationRef.getRootNavigationRef()

    return (
        <AlertModal
            title="Plugins failed to start"
            content={
                <Text variant="text-md/medium" color="text-default">
                    The following plugins encountered errors while starting:
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
                        variant="primary"
                        text="View plugins"
                        onPress={() => {
                            /**
                             * Discord's navigator hierarchy:
                             *
                             * main (Stack)
                             * - tabs (BottomTab)
                             *   - guilds
                             *   - notifications
                             *   - you
                             * - settings (Stack)
                             *   - ...
                             *   - (our screens)
                             */

                            const params = {
                                filter: ['Has Errors'],
                            }

                            if (
                                navigation.getCurrentRoute()?.name ===
                                RouteNames.RevengePlugins
                            )
                                navigation.setParams(params)
                            // React Navigation will bubble our requests to the main navigator if we're already in settings
                            else
                                navigation.navigate('settings', {
                                    screen: RouteNames.RevengePlugins,
                                    params,
                                })
                        }}
                    />
                    <AlertActionButton variant="secondary" text="Got it" />
                </>
            }
        />
    )
}
