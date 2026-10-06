import { TableRowAssetIcon } from '@revenge-mod/components'
import { Design } from '@revenge-mod/discord/design'
import type { PluginRef } from '../utils/repos'

const { TableRow } = Design

export function RepositoryPickerRow({
    text,
    onPress,
}: {
    text: string
    /** Omit when there is nothing to pick. */
    onPress?: () => void
}) {
    return (
        <TableRow
            icon={<TableRowAssetIcon name="GlobeEarthIcon" />}
            label="Repository"
            subLabel={text}
            arrow={Boolean(onPress)}
            onPress={onPress}
        />
    )
}

export function RefPickerRow({
    pluginRef,
    version,
    onPress,
}: {
    /** `undefined` shows the version alone. */
    pluginRef: PluginRef | undefined
    /** Display text for the version, eg. `v1.0.0`. */
    version: string
    /** Omit when there is nothing to pick. */
    onPress?: () => void
}) {
    const channel = pluginRef?.type === 'channel' ? pluginRef.channel : null

    return (
        <TableRow
            icon={<TableRowAssetIcon name="LocationIcon" />}
            label={channel ? 'Channel' : 'Version'}
            subLabel={channel ? `${channel} • ${version}` : version}
            arrow={Boolean(onPress)}
            onPress={onPress}
        />
    )
}
