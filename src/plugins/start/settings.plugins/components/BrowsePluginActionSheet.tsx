import { getAssetIdByName } from '@revenge-mod/assets'
import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { PluginInfo } from './PluginCard'
import { IdRow, RepositoryRow } from './PluginOptionsActionSheet'

const { ActionSheet, Button, Stack, TableRowGroup } = Design

const DownloadIcon = getAssetIdByName('DownloadIcon', 'png')!

export interface BrowsePluginActionSheetProps {
    name: string
    author: string
    description: string
    version: string
    icon?: string
    id: string
    /** Display text for the Repository row, eg. `Name (url)`. */
    repositoryText: string
    onInstall: () => void
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
    repositoryText,
    onInstall,
    sheetKey,
}: BrowsePluginActionSheetProps) {
    return (
        <ActionSheet>
            <Stack spacing={24} style={{ paddingTop: 8 }}>
                <PluginInfo
                    name={name}
                    author={author}
                    version={version}
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
                                onInstall()
                            }}
                        />
                    }
                />
                <TableRowGroup title="Advanced">
                    <IdRow id={id} />
                    <RepositoryRow text={repositoryText} copyable />
                </TableRowGroup>
            </Stack>
        </ActionSheet>
    )
}
