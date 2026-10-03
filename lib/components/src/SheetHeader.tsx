import { Design } from '@revenge-mod/discord/design'
import { StyleSheet } from 'react-native'
import type { ReactNode } from 'react'

export interface SheetHeaderProps {
    title: string
    /** Shown on the other side of the title, such as a button. */
    action?: ReactNode
    /**
     * Which side the title is on.
     * @default 'left'
     */
    aligned?: 'left' | 'right'
}

/** Sheet title with an optional action, an alternative to `Design.BottomSheetTitleHeader`. */
export default function SheetHeader({
    title,
    action,
    aligned = 'left',
}: SheetHeaderProps) {
    const right = aligned === 'right'

    return (
        <Design.Stack
            direction="horizontal"
            justify="space-between"
            align="center"
            style={[styles.header, right && styles.reverse]}
        >
            <Design.Text
                variant="redesign/heading-18/semibold"
                color="mobile-text-heading-primary"
                accessibilityRole="header"
                style={[styles.title, right && styles.titleRight]}
            >
                {title}
            </Design.Text>
            {action}
        </Design.Stack>
    )
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 16,
    },
    reverse: {
        flexDirection: 'row-reverse',
    },
    title: {
        flexShrink: 1,
    },
    titleRight: {
        textAlign: 'right',
    },
})
