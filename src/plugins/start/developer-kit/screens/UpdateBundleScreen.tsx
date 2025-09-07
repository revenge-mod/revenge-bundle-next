import Page from '@revenge-mod/components/Page'
import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { BundleUpdaterManager, FileModule } from '@revenge-mod/discord/native'
import React from 'react'

export default function UpdateBundleScreen() {
    const [newBundle, setNewBundle] = React.useState('')

    return (
        <Page spacing={16}>
            <Design.TextInput
                label="Update Bundle File"
                placeholder="Enter new bundle URL"
                description="Change the JavaScript bundle URL for loading a different version of the Revenge Next bundle."
                value={newBundle}
                onChange={v => setNewBundle(v)}
            />
            <Design.Button
                text="Apply Changes"
                variant="primary"
                onPress={() => {
                    if (newBundle) {
                        FileModule.writeFile(
                            'documents',
                            'pyoncord/loader.json',
                            JSON.stringify({
                                customLoadUrl: {
                                    enabled: true,
                                    url: newBundle,
                                },
                            }),
                            'utf8',
                        )
                        AlertActionCreators.openAlert(
                            'change-bundle-success',
                            <UpdateBundleSuccessAlert />,
                        )
                    }
                }}
            >
                Apply Changes
            </Design.Button>
            <Design.Button
                text="Reset URL to default (Copyparty)"
                variant="secondary"
                onPress={() => {
                    setNewBundle('https://copyparty.palmdevs.me/revenge.bundle')
                }}
            />
        </Page>
    )
}

function UpdateBundleSuccessAlert() {
    return (
        <Design.AlertModal
            title="Bundle URL Changed"
            content={
                <Design.Text variant="text-xl/bold">
                    You must reload Discord to apply the new bundle.
                </Design.Text>
            }
            actions={
                <Design.AlertActionButton
                    text="Reload"
                    variant="primary"
                    onPress={() => {
                        BundleUpdaterManager.reload()
                    }}
                />
            }
        />
    )
}
