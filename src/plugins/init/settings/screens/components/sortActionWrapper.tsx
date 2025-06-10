import SortActionSheet from './sortActionSheet';

export default function SortActionSheetWrapper(props: any) {
   
    return (
        <SortActionSheet
            sortOptions={props.sortOptions}
            onSelectSort={props.onSelectSort}
        />
    );
}
