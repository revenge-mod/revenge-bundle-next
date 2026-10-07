import { ReactNativeSafeAreaContext } from '@revenge-mod/externals/react-native-safe-area-context'
import { noop } from '@revenge-mod/utils/callback'
import { useCallback, useRef, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import type { LayoutChangeEvent } from 'react-native'

/** Padding per side. */
const AlertPadding = 24
/** Vertical margin from the safe area. */
const AlertVerticalMargin = 32
const MinBodyHeight = 160

const styles = StyleSheet.create({
    actionsEnd: {
        position: 'absolute',
        bottom: 0,
        width: 0,
        height: 0,
    },
})

/**
 * Returns the `AlertModal` body height filling the dialog's max height.
 *
 * Put `bodyRef` and `onLayout` on a direct child of `extraContent`, and `actionsEnd` last in the actions.
 */
export function useAlertBodyHeight() {
    const { height: windowHeight } = useWindowDimensions()
    const { top, bottom } = ReactNativeSafeAreaContext.useSafeAreaInsets()
    const dialogMaxHeight = windowHeight - top - bottom - AlertVerticalMargin

    const bodyRef = useRef<View>(null)
    const actionsEndRef = useRef<View>(null)
    const [available, setAvailable] = useState<number | null>(null)

    const onLayout = useCallback(
        (e: LayoutChangeEvent) => {
            const { y, height } = e.nativeEvent.layout
            const body = bodyRef.current
            if (!body) return

            actionsEndRef.current?.measureLayout(
                body,
                (_, actionTop, __, actionHeight) => {
                    const dialogHeight =
                        AlertPadding * 2 + y + actionTop + actionHeight
                    const next = Math.max(
                        MinBodyHeight,
                        Math.floor(height + dialogMaxHeight - dialogHeight),
                    )

                    setAvailable(prev => (prev === next ? prev : next))
                },
                noop,
            )
        },
        [dialogMaxHeight],
    )

    return {
        available: available ?? dialogMaxHeight / 2,
        bodyRef,
        onLayout,
        actionsEnd: (
            <View
                ref={actionsEndRef}
                pointerEvents="none"
                style={styles.actionsEnd}
            />
        ),
    }
}
