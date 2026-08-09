import { Design } from '@revenge-mod/discord/design'
import type { Repo } from '@revenge-mod/plugins/_/repositories'

const { AlertModal, AlertActionButton, Text } = Design

export default function RepoRemoveConfirmationAlert({
    repo,
    action,
}: {
    repo: Repo
    action: () => Promise<void> | void
}) {
    return (
        <AlertModal
            title="Remove repository?"
            content={
                <Text color="text-default">
                    <Text variant="text-md/semibold" color="text-default">
                        {repo.name ?? repo.url}
                    </Text>{' '}
                    will be removed. You can restore the default repositories by
                    clearing Plugin Settings data.
                </Text>
            }
            actions={
                <>
                    <AlertActionButton
                        onPress={action}
                        text="Remove"
                        variant="destructive"
                    />
                    <AlertActionButton text="Cancel" variant="secondary" />
                </>
            }
        />
    )
}
