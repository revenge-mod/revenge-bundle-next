import { Design } from '@revenge-mod/discord/design'
import {
    listRepoPlugins,
    type RepoPluginListing,
    type RepoUpdate,
} from '@revenge-mod/plugins/_/repositories'
import { useEffect, useState } from 'react'
import { View } from 'react-native'

const { AlertModal, AlertActionButton, Text } = Design

interface UpdateDetail {
    id: string
    name: string
    author: string
    installed: string
    available: string
    channel: string
}

export default function PluginUpdatesFoundAlert({
    updates,
    action,
}: {
    updates: RepoUpdate[]
    action: () => Promise<void>
}) {
    const [details, setDetails] = useState<UpdateDetail[] | null>(null)

    useEffect(() => {
        const repoMap = new Map<string, RepoUpdate[]>()
        for (const update of updates) {
            const repo = update.repo!
            if (!repoMap.has(repo)) repoMap.set(repo, [])
            repoMap.get(repo)!.push(update)
        }

        const allDetails: UpdateDetail[] = []

        Promise.all(
            [...repoMap.entries()].map(async ([repo, repoUpdates]) => {
                let listings: RepoPluginListing[]
                try {
                    listings = await listRepoPlugins(repo)
                } catch {
                    listings = []
                }

                for (const update of repoUpdates) {
                    const listing = listings.find(l => l.id === update.id)
                    allDetails.push({
                        id: update.id,
                        name: listing?.name ?? update.id,
                        author: listing?.author ?? 'Unknown',
                        installed: update.installed,
                        available: update.available,
                        channel: update.channel,
                    })
                }
            }),
        ).then(() => setDetails(allDetails))
    }, [updates])

    return (
        <AlertModal
            title="Updates Found"
            content={
                <Text color="text-default">
                    The following plugins have updates available:
                </Text>
            }
            extraContent={
                <View style={{ paddingTop: 8 }}>
                    {details === null ? (
                        <Text color="text-muted">Loading...</Text>
                    ) : (
                        details.map(detail => (
                            <View
                                key={detail.id}
                                style={{ marginBottom: 12 }}
                            >
                                <Text
                                    variant="text-md/semibold"
                                    color="text-default"
                                >
                                    {detail.name}
                                </Text>
                                <Text color="text-muted">
                                    {detail.installed} → {detail.available} (
                                    {detail.channel})
                                </Text>
                                <Text color="text-muted">
                                    by {detail.author}
                                </Text>
                            </View>
                        ))
                    )}
                </View>
            }
            actions={
                <>
                    <AlertActionButton
                        onPress={action}
                        text="Update"
                        variant="primary"
                    />
                    <AlertActionButton text="Not now" variant="secondary" />
                </>
            }
        />
    )
}
