import { styles } from '@revenge-mod/components/_'
import { Tokens } from '@revenge-mod/discord/common'
import { Design } from '@revenge-mod/discord/design'
import { ClientInfoModule } from '@revenge-mod/discord/native'
import { Clipboard } from '@revenge-mod/externals/react-native-clipboard'
import { ReactNativeSafeAreaContext } from '@revenge-mod/externals/react-native-safe-area-context'
import { getErrorStack } from '@revenge-mod/utils/error'
import { ScrollView, StyleSheet, View } from 'react-native'
import { FullVersion } from '~/constants'
import type { ComponentProps } from 'react'

// TODO(PalmDevs): Rolldown 1.0.0-beta.34 breaks destructuring with quoted keys, revert to original when this is fixed
const ossReleaseVersion =
    // @ts-expect-error
    HermesInternal.getRuntimeProperties()['OSS Release Version']

const { createStyles, Button, Card, Stack, Text } = Design

const useErrorBoundaryStyles = createStyles({
    view: {
        backgroundColor: Tokens.default.colors.BACKGROUND_BASE_LOWER,
        paddingHorizontal: 16,
        paddingVertical: 24,
        flex: 1,
        gap: 16,
    },
})

const additionalStyles = StyleSheet.create({
    headerContainer: {
        gap: 4,
    },
    scrollView: {
        gap: 8,
        flex: 1,
    },
    stackTrace: {
        fontFamily: 'monospace',
        fontWeight: 'bold',
        marginBottom: 8,
    },
})

interface RenderError extends Error {
    componentStack?: string
}

export default function ErrorBoundaryScreen({
    error,
    rerender,
    reload,
}: {
    error: RenderError | unknown
    rerender: () => void
    reload: () => void
}) {
    const errorBoundaryStyles = useErrorBoundaryStyles()
    const Client = ClientInfoModule.getConstants()

    return (
        <ReactNativeSafeAreaContext.SafeAreaView
            style={errorBoundaryStyles.view}
        >
            <View style={additionalStyles.headerContainer}>
                <Text variant="display-lg">Error!</Text>
                <Text variant="text-md/normal">
                    An error was thrown while rendering components. This could
                    be caused by plugins, Revenge or Discord.
                </Text>
                <Text variant="text-sm/semibold" color="text-muted">
                    {Client.Version} ({Client.Build}) • RN{' '}
                    {ossReleaseVersion.slice(7)} • {FullVersion}
                </Text>
            </View>
            <LabeledCard label="Error" rawContent={getErrorStack(error)}>
                <Text variant="text-md/medium">{String(error)}</Text>
                {error instanceof Error && error.stack && (
                    <ScrollView
                        style={additionalStyles.scrollView}
                        fadingEdgeLength={64}
                    >
                        {parseStackTrace(
                            error.stack?.slice(String(error).length + 1),
                        ).map(({ at, file, line, column }) => (
                            // biome-ignore lint/correctness/useJsxKeyInIterable: This never gets rerendered
                            <Text
                                variant="text-sm/bold"
                                style={additionalStyles.stackTrace}
                            >
                                {at}
                                {'\n'}
                                <Text color="text-muted">
                                    {file}
                                    {
                                        <>
                                            :{line}:{column}
                                        </>
                                    }
                                </Text>
                            </Text>
                        ))}
                    </ScrollView>
                )}
            </LabeledCard>
            {error instanceof Error &&
                (error as RenderError).componentStack && (
                    <LabeledCard
                        scrollable
                        label="Component Stack"
                        style={styles.flex}
                        rawContent={(error as RenderError).componentStack!}
                    >
                        <Text selectable variant="text-md/medium">
                            {...parseStackTrace(
                                (error as RenderError).componentStack!.slice(1),
                            ).map(({ at }) => [
                                '<',
                                // biome-ignore lint/correctness/useJsxKeyInIterable: This never gets rerendered
                                <Text variant="text-md/bold">{at}</Text>,
                                '/>\n',
                            ])}
                        </Text>
                    </LabeledCard>
                )}
            <Stack direction="horizontal" spacing={16}>
                <Button
                    style={styles.flex}
                    variant="secondary"
                    text="Retry Render"
                    onPress={rerender}
                />
                <Button
                    style={styles.flex}
                    variant="destructive"
                    text="Reload"
                    onPress={reload}
                />
            </Stack>
        </ReactNativeSafeAreaContext.SafeAreaView>
    )
}

export interface LabeledCardProps extends ComponentProps<typeof Card> {
    label: string
    rawContent?: string
    scrollable?: boolean
}

export function LabeledCard(props: LabeledCardProps) {
    const ViewComponent = props.scrollable ? ScrollView : View

    return (
        <Card
            {...props}
            style={[
                additionalStyles.scrollView,
                ...(Array.isArray(props.style) ? props.style : [props.style]),
            ]}
        >
            <Stack direction="horizontal">
                <Text variant="heading-xl/semibold" style={styles.grow}>
                    {props.label}
                </Text>
                {props.rawContent && (
                    <Button
                        variant="secondary"
                        size="sm"
                        text="Copy"
                        onPress={() => {
                            Clipboard.setString(props.rawContent as string)
                        }}
                    />
                )}
            </Stack>
            <ViewComponent
                style={additionalStyles.scrollView}
                fadingEdgeLength={32}
            >
                {props.children}
            </ViewComponent>
        </Card>
    )
}

interface StackFrame {
    at: string
    file: string
    line: number | null
    column: number | null
}

const IndexBundleFilePath = (
    HermesInternal as HermesInternalObject
).getFunctionLocation(alert).fileName
const RevengeFilePath = (
    HermesInternal as HermesInternalObject
).getFunctionLocation(ErrorBoundaryScreen).fileName

const StackFrameRegex = /at (.+) \(([^:]+):(\d+):(\d+)\)|at (.+)? \(([^)]+)\)/

function parseStackTrace(stackTrace: string): StackFrame[] {
    const frames: StackFrame[] = []
    const lines = stackTrace.split('\n')

    for (const line of lines) {
        const match = StackFrameRegex.exec(line.trim())

        if (match) {
            let at: string
            let path: string
            let ln: number | null = null
            let col: number | null = null

            if (match[3] && match[4]) {
                // Case where line and column numbers are present
                at = match[1]!
                path = match[2]!
                ln = Number(match[3])
                col = Number(match[4])
            } else {
                // Case where line and column numbers are missing (native functions or just file path)
                at = match[5]!
                path = match[6]!
            }

            switch (path) {
                case IndexBundleFilePath:
                    path = 'Discord'
                    break
                case RevengeFilePath:
                    path = 'Revenge'
                    break
            }

            frames.push({
                at: at,
                file: path,
                line: ln,
                column: col,
            })
        } else {
            // For lines that don't match the expected format
            frames.push({
                at: 'UNABLE TO PARSE LINE',
                file: line,
                line: null,
                column: null,
            })
        }
    }

    return frames
}
