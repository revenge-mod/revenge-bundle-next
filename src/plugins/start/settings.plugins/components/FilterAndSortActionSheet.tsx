import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { Design } from '@revenge-mod/discord/design'
import { useState } from 'react'
import type { AssetId } from '@revenge-mod/assets/types'
import type { AnyPlugin, InternalPluginMeta } from '@revenge-mod/plugins/_'

export interface FilterAndSortActionSheetProps {
    filters: Record<
        string,
        {
            icon: AssetId
            desc?: string
            filter: (p: AnyPlugin, meta: InternalPluginMeta) => boolean
        }
    >
    filter: string[]
    setFilter: (filters: string[]) => void
    matchAll: boolean
    setMatchAll: (matchAll: boolean) => void
    sorts: Record<
        string,
        [icon: AssetId, (a: AnyPlugin, b: AnyPlugin) => number]
    >
    sort: string
    setSort: (fn: string) => void
    reverse: boolean
    setReverse: (reverse: boolean) => void
}

const {
    ActionSheet,
    BottomSheetTitleHeader,
    TableCheckboxRow,
    TableRadioGroup,
    TableRadioRow,
    TableRowGroup,
    TableSwitchRow,
} = Design

export default function FilterAndSortActionSheet({
    filters,
    filter,
    setFilter,
    matchAll,
    setMatchAll,
    sorts,
    sort,
    setSort,
    reverse,
    setReverse,
}: FilterAndSortActionSheetProps) {
    const [filter_, setFilter_] = useState(filter)
    const [sort_, setSort_] = useState(sort)
    const [reverse_, setReverse_] = useState(reverse)
    const [matchAll_, setMatchAll_] = useState(matchAll ?? false)

    return (
        <ActionSheet>
            <BottomSheetTitleHeader title="Filter & Sort" />
            <TableRowGroup title="Filter by">
                {Object.entries(filters).map(([label, { icon, desc }]) => {
                    const checked = filter_.includes(label)

                    return (
                        <TableCheckboxRow
                            key={label}
                            icon={<TableRowAssetIcon id={icon} />}
                            label={label}
                            subLabel={desc}
                            value={label}
                            checked={checked}
                            onPress={() => {
                                const v = checked
                                    ? filter_.filter(f => f !== label)
                                    : [...filter_, label]

                                setFilter(v)
                                setFilter_(v)
                            }}
                        />
                    )
                })}
            </TableRowGroup>
            <TableRowGroup>
                <TableSwitchRow
                    label="Match all"
                    subLabel="Plugins must match all selected filters to show up."
                    value={matchAll_}
                    onValueChange={v => {
                        setMatchAll(v)
                        setMatchAll_(v)
                    }}
                />
            </TableRowGroup>
            <TableRadioGroup
                title="Sort by"
                defaultValue={sort_}
                onChange={v => {
                    setSort(v)
                    setSort_(v)
                }}
            >
                {Object.entries(sorts).map(([label, [icon]]) => (
                    <TableRadioRow
                        key={label}
                        icon={<TableRowAssetIcon id={icon} />}
                        label={label}
                        value={label}
                    />
                ))}
            </TableRadioGroup>
            <TableRowGroup>
                <TableSwitchRow
                    label="Reverse results"
                    value={reverse_}
                    onValueChange={v => {
                        setReverse(v)
                        setReverse_(v)
                    }}
                />
            </TableRowGroup>
        </ActionSheet>
    )
}
