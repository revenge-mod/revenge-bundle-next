import { getAssetIdByName } from '@revenge-mod/assets'
import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { useState } from 'react'
import { PluginInfo } from './PluginCard'
import { IdRow, RepositoryRow } from './PluginOptionsActionSheet'
import type { RepoPluginListing } from '@revenge-mod/plugins/_/repositories'

const {
    ActionSheet,
    Button,
    Stack,
    TableRowGroup,
    TableRadioGroup,
    TableRadioRow,
} = Design

const DownloadIcon = getAssetIdByName('DownloadIcon', 'png')!

export interface BrowsePluginActionSheetProps {
    name: string
    author: string
    description: string
    version: string
    icon?: string
    id: string
    listing: RepoPluginListing
    channel: string
    /** Display text for the Repository row, eg. `Name (url)`. */
    repositoryText: string
    onInstall: (channel?: string, version?: string) => void
    sheetKey: string
}

/**
 * Sheet for a plugin that isn't installed yet, opened from the Browse screen.
 */
export default function BrowsePluginActionSheet({
    name,
    author,
    description,
    version,
    icon,
    id,
    listing,
    channel,
    repositoryText,
    onInstall,
    sheetKey,
}: BrowsePluginActionSheetProps) {
    const [selectedChannel, setSelectedChannel] = useState(channel)
    const selectedVersion = selectedChannel
        ? (listing.channels[selectedChannel] ?? '')
        : version

    const channelNames = Object.keys(listing.channels)

    return (
        <ActionSheet>
            <Stack spacing={24} style={{ paddingTop: 8 }}>
                <PluginInfo
                    name={name}
                    author={author}
                    version={selectedVersion}
                    description={description}
                    icon={icon}
                    actions={
                        <Button
                            size="sm"
                            text="Install"
                            icon={DownloadIcon}
                            onPress={() => {
                                ActionSheetActionCreators.hideActionSheet(
                                    sheetKey,
                                )
                                onInstall(selectedChannel, selectedVersion)
                            }}
                        />
                    }
                />
                {channelNames.length > 0 && (
                    <TableRadioGroup
                        title="Channel"
                        defaultValue={selectedChannel}
                        onChange={v => setSelectedChannel(v as string)}
                    >
                        {channelNames.map(c => (
                            <TableRadioRow
                                key={c}
                                label={c}
                                value={c}
                            />
                        ))}
                    </TableRadioGroup>
                )}
                <TableRowGroup title="Advanced">
                    <IdRow id={id} />
                    <RepositoryRow text={repositoryText} copyable />
                </TableRowGroup>
            </Stack>
        </ActionSheet>
    )
}
