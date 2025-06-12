import { styles } from '@revenge-mod/components/_'
import { ToastActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { SettingListRenderer } from '@revenge-mod/discord/modules/settings/renderer'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { View } from 'react-native'
import { api } from '..'
import { Setting } from '../constants'
import { RDTContext, useIsConnected } from '../react-devtools'

const CircleCheckIcon = lookupGeneratedIconComponent(
    'CircleCheckIcon',
    'CircleCheckIcon-secondary',
    'CircleCheckIcon-primary',
)

// TODO(plugins/settings): debug bridge
export default function RevengeDeveloperSettingScreen() {
    return (
        <Design.Stack spacing={0} style={styles.flex}>
            {globalThis.__REACT_DEVTOOLS__ && <RDTAddrSetting />}
            <SettingListRenderer.SettingsList
                sections={[
                    {
                        settings: [],
                    },
                    {
                        settings: [
                            Setting.RDTVersion,
                            Setting.RDTAutoConnect,
                            Setting.RDTConnect,
                            Setting.RDTDisconnect,
                        ],
                    },
                    {
                        label: 'Tools',
                        settings: [Setting.EvalJS, Setting.AssetBrowser],
                    },
                ]}
            />
        </Design.Stack>
    )
}

export function RDTAddrSetting() {
    const open = useIsConnected()
    const settings = api.storage.use(s => s.devtools?.address)

    return (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Design.TextInput
                defaultValue={settings?.devtools.address ?? RDTContext.addr}
                editable={!open}
                isDisabled={open}
                label="React DevTools"
                leadingText="ws://"
                onBlur={() => {
                    api.storage
                        .set({
                            devtools: {
                                address: RDTContext.addr,
                            },
                        })
                        .then(() => {
                            ToastActionCreators.open({
                                IconComponent: CircleCheckIcon,
                                key: 'REACT_DEVTOOLS_ADDRESS_SAVED',
                                content: 'Address saved',
                            })
                        })
                }}
                onChange={text => (RDTContext.addr = text)}
                returnKeyType="done"
            />
        </View>
    )
}
