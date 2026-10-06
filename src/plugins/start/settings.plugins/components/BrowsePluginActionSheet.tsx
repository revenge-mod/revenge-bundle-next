import { getAssetIdByName } from '@revenge-mod/assets'
import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { useState } from 'react'
import { retargetPluginRef, versionOfChannel } from '../utils/repos'
import { formatRepository } from '../utils/strings'
import { PluginAuthor, PluginInfo } from './PluginCard'
import { IdRow } from './PluginOptionsActionSheet'
import { openPluginRefPickerActionSheet } from './PluginRefPickerActionSheet'
import { openPluginRepositoryPickerActionSheet } from './PluginRepositoryPickerActionSheet'
import { RefPickerRow, RepositoryPickerRow } from './PluginSourceRows'
import type { PluginRef, RepoOffer } from '../utils/repos'
import type { BrowseEntry } from './PluginList'

const { ActionSheet, Button, Stack, TableRowGroup } = Design

const DownloadIcon = getAssetIdByName('DownloadIcon', 'png')!

export interface BrowsePluginActionSheetProps {
    entry: BrowseEntry
    onInstall: (repo: string, ref: PluginRef) => void
    sheetKey: string
}

/**
 * Sheet for a plugin that isn't installed yet, opened from the Browse screen.
 * Picks the repository and channel or version to install.
 */
export default function BrowsePluginActionSheet({
    entry,
    onInstall,
    sheetKey,
}: BrowsePluginActionSheetProps) {
    const [offer, setOffer] = useState<RepoOffer>({
        url: entry.repoUrl,
        name: entry.repoName,
        listing: entry.listing,
    })
    const [ref, setRef] = useState<PluginRef>({
        type: 'channel',
        channel: entry.channel,
    })

    const { listing } = offer
    const { id, name } = listing
    const version =
        ref.type === 'version'
            ? ref.version
            : (versionOfChannel(listing, ref.channel) ?? '')

    return (
        <ActionSheet>
            <Stack spacing={24} style={{ paddingTop: 8 }}>
                <PluginInfo
                    info={listing}
                    author={
                        <PluginAuthor
                            pluginName={name}
                            author={listing.author}
                            contributors={listing.contributors}
                        />
                    }
                    actions={
                        <Button
                            size="sm"
                            text="Install"
                            icon={DownloadIcon}
                            onPress={() => {
                                ActionSheetActionCreators.hideActionSheet(
                                    sheetKey,
                                )
                                onInstall(offer.url, ref)
                            }}
                        />
                    }
                />
                <TableRowGroup title="Source">
                    <RepositoryPickerRow
                        text={formatRepository(offer.url, offer.name)}
                        onPress={() =>
                            openPluginRepositoryPickerActionSheet({
                                id,
                                name,
                                repo: offer.url,
                                onSelect: picked => {
                                    setOffer(picked)
                                    setRef(r =>
                                        retargetPluginRef(r, picked.listing),
                                    )
                                    return true
                                },
                            })
                        }
                    />
                    <RefPickerRow
                        pluginRef={ref}
                        version={`v${version}`}
                        onPress={() =>
                            openPluginRefPickerActionSheet({
                                id,
                                repo: offer.url,
                                pluginRef: ref,
                                onSelect: picked => {
                                    setRef(picked)
                                    return true
                                },
                            })
                        }
                    />
                </TableRowGroup>
                <TableRowGroup title="Advanced">
                    <IdRow id={id} />
                </TableRowGroup>
            </Stack>
        </ActionSheet>
    )
}
