import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { nodeUtil } from '@revenge-mod/externals/browserify'
import { getErrorStack } from '@revenge-mod/utils/error'
import { sleep } from '@revenge-mod/utils/promise'
import { useRef, useState } from 'react'
import { api } from '..'
import { Setting } from '../constants'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const AlertKey = 'evaluate-javascript'

const EvalJSSetting: SettingsItem = {
    parent: Setting.RevengeDeveloper,
    IconComponent: () => <TableRowAssetIcon name="FileIcon" />,
    title: () => 'Evaluate JavaScript',
    useDescription: () => 'Runs a JavaScript code snippet.',
    onPress: () => {
        AlertActionCreators.openAlert(AlertKey, <EvalJSAlert />)
    },
    type: 'pressable',
}

const {
    AlertActionButton,
    AlertModal,
    Button,
    Slider,
    Stack,
    TableRow,
    TableRowGroup,
    TableSwitchRow,
    Text,
    TextArea,
} = Design

function EvalJSAlert() {
    const code = useRef('')
    const [awaitResult, setAwaitResult] = useState(true)
    const [showHidden, setShowHidden] = useState(true)
    const [inspectDepth, setInspectDepth] = useState(3)

    return (
        <AlertModal
            actions={
                <>
                    <Button
                        onPress={async function onPress() {
                            const key = `_${Math.random()
                                .toString(36)
                                .substring(2, 15)}`

                            try {
                                if (!api) {
                                    alert(
                                        'Unable to provide plugin API. Running snippet in a second...'
                                    )

                                    await sleep(1000)
                                }
                                // @ts-expect-error
                                else globalThis[key] = api

                                // biome-ignore lint/security/noGlobalEval: Intentional
                                const res = eval(
                                    `var api=${key},{unscoped:revenge}=api;undefined;${code.current}//# sourceURL=Revenge:EvalJS`,
                                )

                                alert(
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
                                alert(getErrorStack(e))
                            }

                            AlertActionCreators.dismissAlert(AlertKey)
                        }}
                        text="Evaluate"
                        variant="primary"
                    />
                    <AlertActionButton text="Cancel" variant="secondary" />
                </>
            }
            extraContent={
                <Stack>
                    <TextArea
                        autoFocus
                        label="Code"
                        onChange={v => {
                            code.current = v
                        }}
                        placeholder="revenge.discord.native.BundleUpdaterManager.reload()"
                        size="md"
                    />
                    <TableRowGroup>
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
                            trailing={<Text variant="text-sm/normal">{inspectDepth}</Text>}
                        />
                    </TableRowGroup>
                    <Slider
                        endIcon={<Text variant="text-sm/normal">10</Text>}
                        maximumValue={10}
                        minimumValue={1}
                        onValueChange={setInspectDepth}
                        startIcon={<Text variant="text-sm/normal">1</Text>}
                        step={1}
                        value={inspectDepth}
                    />
                </Stack>
            }
            title="Evaluate JavaScript"
        />
    )
}

export default EvalJSSetting