import { styles } from '@revenge-mod/components/_'
import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { SettingListRenderer } from '@revenge-mod/discord/modules/settings/renderer'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { StyleSheet, View } from 'react-native'
import { api } from '..'
import { Setting } from '../constants'
import { DTContext, useIsConnected as useIsDTConnected } from '../devtools'
import {
    RDTContext,
    useIsConnected as useIsRDTConnected,
} from '../react-devtools'

const CircleCheckIcon = lookupGeneratedIconComponent(
    'CircleCheckIcon',
    'CircleCheckIcon-secondary',
    'CircleCheckIcon-primary',
)

import { ScrollView } from 'react-native'

const listStyles = StyleSheet.create({
    container: {
        flexGrow: 0,
        flexShrink: 0,
        height: 'auto',
    },
})

export default function RevengeDeveloperSettingScreen() {
    return (
        <ScrollView style={styles.flex}>
            <Design.Stack spacing={8}>
                <View>
                    <SettingListRenderer.SettingsList
                        containerStyle={listStyles.container}
                        node={{
                            type: 'list',
                            ListHeaderComponent: DTAddrSetting,
                            sections: [
                                {
                                    settings: [
                                        Setting.DTAutoConnect,
                                        Setting.DTConnect,
                                        Setting.DTDisconnect,
                                    ],
                                },
                            ],
                        }}
                    />
                </View>
                <View>
                    <SettingListRenderer.SettingsList
                        containerStyle={listStyles.container}
                        node={{
                            type: 'list',
                            ListHeaderComponent: RDTContext.active
                                ? RDTAddrSetting
                                : undefined,
                            sections: [
                                {
                                    settings: [
                                        Setting.RDTAutoConnect,
                                        Setting.RDTConnect,
                                        Setting.RDTDisconnect,
                                    ],
                                },
                                {
                                    label: 'Tools',
                                    settings: [
                                        Setting.EvalJS,
                                        Setting.AssetBrowser,
                                        Setting.TestErrorBoundary,
                                    ],
                                },
                            ],
                        }}
                    />
                </View>
            </Design.Stack>
        </ScrollView>
    )
}

export function DTAddrSetting() {
    const open = useIsDTConnected()
    const settings = api.storage.use(s => s.devTools?.address)

    return (
        <Design.TextInput
            defaultValue={settings?.devTools.address ?? DTContext.addr}
            editable={!open}
            isDisabled={open}
            label="DevTools"
            leadingText="ws://"
            onBlur={() =>
                api.storage
                    .set({
                        devTools: {
                            address: DTContext.addr,
                        },
                    })
                    .then(() =>
                        ToastActionCreators.open({
                            IconComponent: CircleCheckIcon,
                            key: 'DEVTOOLS_ADDRESS_SAVED',
                            content: 'Address saved',
                        }),
                    )
            }
            onChange={text => {
                DTContext.addr = text
            }}
            returnKeyType="done"
        />
    )
}

export function RDTAddrSetting() {
    const open = useIsRDTConnected()
    const settings = api.storage.use(s => s.reactDevTools?.address)

    return (
        <Design.TextInput
            defaultValue={settings?.reactDevTools.address ?? RDTContext.addr}
            editable={!open}
            isDisabled={open}
            label="React DevTools"
            leadingText="ws://"
            onBlur={() =>
                api.storage
                    .set({
                        reactDevTools: {
                            address: RDTContext.addr,
                        },
                    })
                    .then(() =>
                        ToastActionCreators.open({
                            IconComponent: CircleCheckIcon,
                            key: 'REACT_DEVTOOLS_ADDRESS_SAVED',
                            content: 'Address saved',
                        }),
                    )
            }
            onChange={text => {
                RDTContext.addr = text
            }}
            returnKeyType="done"
        />
    )
}
