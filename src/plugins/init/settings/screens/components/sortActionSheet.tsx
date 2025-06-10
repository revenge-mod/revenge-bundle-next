import { Design } from '@revenge-mod/discord/design';
import type { Plugin } from '@revenge-mod/plugins/types';

type SortActionSheetProps = {
    sortOptions: Record<string, (a: Plugin[], b: Plugin[]) => number>;
    onSelectSort: (fn: string) => void;
};


const {
    ActionSheet,
    ActionSheetRow

} = Design

export default function SortActionSheet({ sortOptions, onSelectSort }: SortActionSheetProps) {
    return (
        <ActionSheet>


            {Object.entries(sortOptions).map(([label]) => (
                <ActionSheetRow
                    key={label}
                    label={label}
                    onPress={() => { onSelectSort(label) }
                    }
                />
            ))}

        </ActionSheet>
    );
}
