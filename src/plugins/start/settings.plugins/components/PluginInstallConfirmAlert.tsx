import { Design } from '@revenge-mod/discord/design'
import { confirmInstall } from '@revenge-mod/plugins/_'
import type { PluginInstallReadyEvent } from '@revenge-mod/plugins/_'

const { AlertModal, AlertActionButton, Text } = Design

export default function PluginInstallConfirmAlert({
    prompt,
}: {
    prompt: PluginInstallReadyEvent
}) {
    const { manifest } = prompt

    return (
        <AlertModal
            title={`Install ${manifest.name}?`}
            content={`${manifest.id} v${manifest.version}${manifest.author ? ` by ${manifest.author}` : ''}`}
            extraContent={
                prompt.replaces != null ? (
                    <Text
                        variant="text-md/medium"
                        color="text-feedback-critical"
                    >
                        This replaces the installed version {prompt.replaces}.
                        The update applies after a reload.
                    </Text>
                ) : undefined
            }
            actions={
                <>
                    <AlertActionButton
                        text="Install"
                        variant="primary"
                        onPress={() => {
                            confirmInstall(prompt.token, true)
                        }}
                    />
                    <AlertActionButton
                        text="Cancel"
                        variant="secondary"
                        onPress={() => {
                            confirmInstall(prompt.token, false)
                        }}
                    />
                </>
            }
        />
    )
}
