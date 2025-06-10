import { Design } from '@revenge-mod/discord/design'
import type { Plugin } from '@revenge-mod/plugins/types'

export interface SortActionSheetProps {
    sortOptions: Record<string, (a: Plugin[], b: Plugin[]) => number>
    onSelectSort: (fn: string) => void
}

const { ActionSheet, ActionSheetRow } = Design

export function SortActionSheet({
    sortOptions,
    onSelectSort,
}: SortActionSheetProps) {
    return (
        <ActionSheet>
            {Object.entries(sortOptions).map(([label]) => (
                <ActionSheetRow
                    key={label}
                    label={label}
                    onPress={() => {
                        onSelectSort(label)
                    }}
                />
            ))}
        </ActionSheet>
    )
}

export default function SortActionSheetWrapper(props: any) {
    return (
        <SortActionSheet
            sortOptions={props.sortOptions}
            onSelectSort={props.onSelectSort}
        />
    )
}
