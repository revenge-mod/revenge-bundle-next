import { getAssetIdByName } from '@revenge-mod/assets'
import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { Design } from '@revenge-mod/discord/design'
import { useState } from 'react'
import type { AssetId } from '@revenge-mod/assets/types'

const {
    ActionSheet,
    BottomSheetTitleHeader,
    TableCheckboxRow,
    TableRadioGroup,
    TableRadioRow,
    TableRowGroup,
    TableSwitchRow,
} = Design

export const BrowseSortLabels = {
    name: 'Name (A-Z)',
    size: 'Size (smallest first)',
} as const

export type BrowseSortKey = keyof typeof BrowseSortLabels

const SortIcons: Record<BrowseSortKey, AssetId> = {
    name: getAssetIdByName('IdIcon')!,
    size: getAssetIdByName('DownloadIcon')!,
}

export interface BrowseFilterAndSortActionSheetProps {
    /** Repositories that currently have entries to browse. */
    repos: Array<{ url: string; name: string | null }>
    /** Checked repository URLs. */
    checked: string[]
    setChecked: (urls: string[]) => void
    /** Available release channels across all listings. */
    channels: string[]
    /** Selected release channel. Empty string means default. */
    channel: string
    setChannel: (channel: string) => void
    sort: BrowseSortKey
    setSort: (sort: BrowseSortKey) => void
    reverse: boolean
    setReverse: (reverse: boolean) => void
}

export default function BrowseFilterAndSortActionSheet({
    repos,
    checked,
    setChecked,
    channels,
    channel,
    setChannel,
    sort,
    setSort,
    reverse,
    setReverse,
}: BrowseFilterAndSortActionSheetProps) {
    const [checked_, setChecked_] = useState(checked)
    const [reverse_, setReverse_] = useState(reverse)

    return (
        <ActionSheet>
            <BottomSheetTitleHeader title="Filter & Sort" />
            <TableRowGroup title="Filter by Repositories">
                {repos.map(repo => {
                    const isChecked = checked_.includes(repo.url)

                    return (
                        <TableCheckboxRow
                            key={repo.url}
                            label={repo.name ?? repo.url}
                            subLabel={repo.name ? repo.url : undefined}
                            value={repo.url}
                            checked={isChecked}
                            onPress={() => {
                                const v = isChecked
                                    ? checked_.filter(url => url !== repo.url)
                                    : [...checked_, repo.url]

                                setChecked(v)
                                setChecked_(v)
                            }}
                        />
                    )
                })}
            </TableRowGroup>
            <TableRadioGroup
                title="Release channel"
                defaultValue={channel}
                onChange={v => setChannel(v as string)}
            >
                <TableRadioRow
                    label="Default (latest / first available)"
                    value=""
                />
                {channels.map(c => (
                    <TableRadioRow key={c} label={c} value={c} />
                ))}
            </TableRadioGroup>
            <TableRadioGroup
                title="Sort by"
                defaultValue={sort}
                onChange={v => setSort(v as BrowseSortKey)}
            >
                {Object.entries(BrowseSortLabels).map(([key, label]) => (
                    <TableRadioRow
                        key={key}
                        icon={
                            <TableRowAssetIcon
                                id={SortIcons[key as BrowseSortKey]}
                            />
                        }
                        label={label}
                        value={key}
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
