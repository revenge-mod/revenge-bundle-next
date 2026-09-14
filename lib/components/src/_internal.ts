import { StyleSheet } from 'react-native'

export const styles = StyleSheet.create({
    disabled: {
        opacity: 0.5,
        pointerEvents: 'none',
    },
    passthrough: {
        display: 'contents',
    },
    flex: {
        flex: 1,
    },
    grow: {
        flexGrow: 1,
    },
    pagePadding: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
})

export const PageSpacing = 24
