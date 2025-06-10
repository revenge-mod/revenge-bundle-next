import { Design } from '@revenge-mod/discord/design'
import type { InternalPlugin } from '@revenge-mod/plugins/_'

export interface FilterAndSortActionSheetProps<S extends string> {
    sorts: Record<S, (a: InternalPlugin, b: InternalPlugin) => number>
    selectedSort: S
    onSelectSort: (fn: S) => void
}

const { ActionSheet, BottomSheetTitleHeader, TableRadioGroup, TableRadioRow } =
    Design

// TODO(plugins/settings): Add filter options
export default function FilterAndSortActionSheet<S extends string>({
    sorts,
    selectedSort,
    onSelectSort,
}: FilterAndSortActionSheetProps<S>) {
    return (
        <ActionSheet>
            <BottomSheetTitleHeader title="Filter & Sort" />
            <TableRadioGroup
                title="Sort"
                defaultValue={selectedSort}
                onChange={onSelectSort}
            >
                {Object.keys(sorts).map(label => (
                    <TableRadioRow key={label} label={label} value={label} />
                ))}
            </TableRadioGroup>
        </ActionSheet>
    )
}
