import { TableRowAssetIcon } from '@revenge-mod/components'
import { Design } from '@revenge-mod/discord/design'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

const { ActionSheet, Stack, TableRow, TableRowGroup } = Design

export interface PluginRelationsListActionSheetProps {
    title: string
    plugins: AnyPlugin[]
}

export default function PluginRelationsListActionSheet({
    title,
    plugins,
}: PluginRelationsListActionSheetProps) {
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
