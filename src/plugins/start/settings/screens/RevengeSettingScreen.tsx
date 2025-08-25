import { SettingListRenderer } from '@revenge-mod/discord/modules/settings/renderer'
import { Setting } from '../constants'

export default function RevengeSettingScreen() {
    return (
        <SettingListRenderer.SettingsList
            sections={[
                {
                    label: 'Revenge',
                    settings: [
                        Setting.RevengeVersion,
                        Setting.LoaderVersion,
                        Setting.RevengeDiscord,
                        Setting.RevengeSourceRepository,
                        Setting.RevengeLicense,
                    ],
                },
                {
                    label: 'Versions',
                    settings: [
                        Setting.ReactVersion,
                        Setting.ReactNativeVersion,
                        Setting.HermesVersion,
                    ],
                },
                {
                    label: 'Actions',
                    settings: [Setting.Reload],
                },
            ]}
        />
    )
}
