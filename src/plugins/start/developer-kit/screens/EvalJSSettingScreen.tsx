import { Page } from '@revenge-mod/components'
import { Design } from '@revenge-mod/discord/design'
import { nodeUtil } from '@revenge-mod/externals/browserify'
import { getErrorStack } from '@revenge-mod/utils/error'
import { sleep } from '@revenge-mod/utils/promise'
import { useRef, useState } from 'react'
import { ScrollView } from 'react-native'
import { api } from '..'

const {
    Button,
    Card,
    Slider,
    Stack,
    TableRow,
    TableRowGroup,
    TableSwitchRow,
    Text,
    TextArea,
} = Design

export default function EvalJSSettingScreen() {
    const code = useRef('')
    const [result, setResult] = useState('')
    const [awaitResult, setAwaitResult] = useState(true)
    const [showHidden, setShowHidden] = useState(true)
    const [inspectDepth, setInspectDepth] = useState(3)
    const [wordWrap, setWordWrap] = useState(true)

    return (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <Page spacing={16}>
                <TextArea
                    autoFocus
                    label="Code"
                    onChange={v => {
                        code.current = v
                    }}
                    placeholder="revenge.discord.native.BundleUpdaterManager.reload()"
                    size="md"
                />
                <TableRowGroup title="Inspection Options">
                    <TableSwitchRow
                        label="Await result"
                        onValueChange={setAwaitResult}
                        subLabel="Wait for the result of the code before displaying it."
                        value={awaitResult}
                    />
                    <TableSwitchRow
                        label="Show hidden"
                        onValueChange={setShowHidden}
                        subLabel="Show hidden properties of the object."
                        value={showHidden}
                    />
                    <TableRow
                        label="Inspect depth"
                        subLabel="The depth of the object to inspect."
                        trailing={
                            <Text variant="text-sm/normal">{inspectDepth}</Text>
                        }
                    />
                </TableRowGroup>
                <Slider
                    endIcon={<Text variant="text-sm/normal">10</Text>}
                    maximumValue={10}
                    minimumValue={0}
                    onValueChange={setInspectDepth}
                    startIcon={<Text variant="text-sm/normal">0</Text>}
                    step={1}
                    value={inspectDepth}
                />
                <TableRowGroup title="Display Options">
                    <TableSwitchRow
                        label="Word wrap"
                        subLabel="Long results will wrap to the next line."
                        onValueChange={setWordWrap}
                        value={wordWrap}
                    />
                </TableRowGroup>
                <Stack>
                    <Text variant="heading-sm/semibold" color="text-strong">
                        Result
                    </Text>
                    <Card>
                        {/* TODO: Maybe try to make it fill space with minHeight: 128? */}
                        <ScrollView
                            nestedScrollEnabled
                            style={{ maxHeight: 300 }}
                        >
                            <ScrollView
                                nestedScrollEnabled
                                horizontal={!wordWrap}
                            >
                                <Text
                                    selectable
                                    style={{ fontFamily: 'monospace' }}
                                >
                                    {result || '<empty>'}
                                </Text>
                            </ScrollView>
                        </ScrollView>
                    </Card>
                </Stack>
                <Button
                    onPress={async function onPress() {
                        const key = `_${Math.random()
                            .toString(36)
                            .substring(2, 15)}`

                        try {
                            if (!api) {
                                setResult(
                                    '<Revenge API not available, snippet will be run without it...>',
                                )

                                await sleep(1000)
                            }
                            // @ts-expect-error
                            else globalThis[key] = api

                            // biome-ignore lint/security/noGlobalEval: Intentional
                            const res = (0, eval)(
                                `var api=${key},{unscoped:revenge}=api;undefined;${code.current}//# sourceURL=Revenge:EvalJS`,
                            )

                            setResult(
                                nodeUtil.inspect(
                                    awaitResult ? await res : res,
                                    {
                                        depth: inspectDepth,
                                        showHidden,
                                    },
                                ),
                            )

                            // @ts-expect-error
                            delete globalThis[key]
                        } catch (e) {
                            setResult(getErrorStack(e))
                        }
                    }}
                    text="Evaluate"
                    variant="primary"
                />
            </Page>
        </ScrollView>
    )
}
