import TableRowAssetIcon from '@revenge-mod/components/TableRowAssetIcon'
import { AlertActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { useEffect, useState } from 'react'
import { ScrollView, useWindowDimensions } from 'react-native'
import { LicenseFallbackURL } from '~/constants'
import { Setting } from '../constants'
import type { SettingsItem } from '@revenge-mod/discord/modules/settings'

const RevengeLicenseSetting: SettingsItem = {
    parent: Setting.Revenge,
    IconComponent: () => <TableRowAssetIcon name="FileIcon" />,
    useTitle: () => 'License',
    onPress: () => {
        AlertActionCreators.openAlert('revenge-license', <LicenseAlert />)
    },
    type: 'pressable',
}

export default RevengeLicenseSetting

const trimStart = (text: string) => text.replaceAll(/^ +/gm, '')

function LicenseAlert() {
    const { height } = useWindowDimensions()
    const [license, setLicense] = useState<string | null>(null)

    useEffect(() => {
        fetch(__BUILD_LICENSE_URL__)
            .then(response => {
                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch license: ${response.statusText}`,
                    )
                }
                return response.text()
            })
            .then(trimStart)
            .then(setLicense)
            .catch(() => {
                // Fallback to the hardcoded license URL
                fetch(LicenseFallbackURL)
                    .then(response => response.text())
                    .then(trimStart)
                    .then(setLicense)
                    .catch(error => {
                        console.error(
                            'Failed to fetch fallback license:',
                            error,
                        )
                        setLicense('Failed to load license.')
                    })
            })
    }, [])

    return (
        <Design.AlertModal
            title="License"
            content={
                <ScrollView
                    fadingEdgeLength={32}
                    style={{ height: height * 0.75 }}
                >
                    <Design.Text
                        variant="text-sm/medium"
                        color="text-muted"
                        selectable
                        style={{ textAlign: 'left' }}
                    >
                        {license ?? 'Fetching...'}
                    </Design.Text>
                </ScrollView>
            }
            actions={
                <Design.AlertActionButton text="Close" variant="secondary" />
            }
        />
    )
}
