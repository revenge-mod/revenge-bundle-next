import { Design } from '@revenge-mod/discord/design'
import { SettingListRenderer } from '@revenge-mod/discord/modules/settings/renderer'
import { MobileSetting } from '../constants'

export default function RevengeSettingScreen() {
    return (
        <SettingListRenderer.SettingsList
            sections={[
                {
                    label: 'Revenge',
                    settings: [
                        MobileSetting.REVENGE_VERSION,
                        MobileSetting.REVENGE_DISCORD_SERVER,
                        MobileSetting.REVENGE_GITHUB_ORGANIZATION,
                    ],
                    subLabel: (
                        <>
                            <Design.Text variant="text-xs/medium">
                                You are using the next version of Revenge!
                            </Design.Text>
                            <Design.Text
                                color="text-danger"
                                variant="text-xs/semibold"
                            >
                                This version is experimental and may be
                                unstable.
                            </Design.Text>
                        </>
                    ),
                },
                {
                    label: 'Versions',
                    settings: [
                        MobileSetting.REACT_VERSION,
                        MobileSetting.REACT_NATIVE_VERSION,
                        MobileSetting.HERMES_VERSION,
                    ],
                },
                {
                    label: 'Actions',
                    settings: [MobileSetting.RELOAD_APP],
                },
            ]}
        />
    )
}
