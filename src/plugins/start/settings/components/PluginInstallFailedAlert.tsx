import { Design } from '@revenge-mod/discord/design'

const { AlertModal, AlertActionButton, Text } = Design

export default function PluginInstallFailedAlert({ error }: { error: string }) {
    return (
        <AlertModal
            title="Plugin install failed"
            content={
                <Text variant="text-md/medium" color="text-feedback-critical">
                    {error}
                </Text>
            }
            actions={<AlertActionButton text="Got it" />}
        />
    )
}
