import { TableRowAssetIcon } from '@revenge-mod/components'
import { Design } from '@revenge-mod/discord/design'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const { ActionSheet, Stack, TableRow, TableRowGroup } = Design

export interface PluginListActionSheetProps {
    title: string
    plugins: AnyPlugin[]
    sheetKey: string
}

export default function PluginListActionSheet({
    title,
    plugins,
}: PluginListActionSheetProps) {
    return (
        <ActionSheet>
            <Stack spacing={24} style={{ paddingTop: 8 }}>
                <TableRowGroup title={title}>
                    {plugins.map(plugin => (
                        <TableRow
                            key={plugin.manifest.id}
                            icon={<TableRowAssetIcon name="ListBulletsIcon" />}
                            label={plugin.manifest.name}
                            subLabel={plugin.manifest.id}
                        />
                    ))}
                </TableRowGroup>
            </Stack>
        </ActionSheet>
    )
}
