import { Design } from '@revenge-mod/discord/design'
import { Clipboard } from '@revenge-mod/externals/react-native-clipboard'
import { formatPluginError } from '@revenge-mod/plugins/_'
import type { PluginError } from '@revenge-mod/plugins/_'

const { AlertModal, AlertActionButton, Text } = Design

export default function PluginInstallFailedAlert({
    error,
}: {
    error: PluginError
}) {
    return (
        <AlertModal
            title="Plugin install failed"
            content={
                <Text variant="text-md/medium" color="text-feedback-critical">
                    {error.message}
                </Text>
            }
            actions={
                <>
                    <AlertActionButton
                        text="Copy details"
                        variant="secondary"
                        onPress={() => {
                            Clipboard.setString(formatPluginError(error))
                        }}
                    />
                    <AlertActionButton text="Got it" />
                </>
            }
        />
    )
}
