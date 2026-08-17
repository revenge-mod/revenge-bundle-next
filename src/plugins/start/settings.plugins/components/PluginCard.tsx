import { getAssetIdByName } from '@revenge-mod/assets'
import { styles } from '@revenge-mod/components/_'
import FormSwitch from '@revenge-mod/components/FormSwitch'
import { Design } from '@revenge-mod/discord/design'
import {
    isDefaultsOnlyBoot,
    isPluginEnabledInSavedStates,
    isPluginEssential,
    isPluginPendingUpdate,
    isPluginStartable,
} from '@revenge-mod/plugins/_'
import { formatVersion } from '@revenge-mod/plugins/utils'
import { memo } from 'react'
import { Pressable } from 'react-native'
import { handleDisablePlugin, handleEnablePlugin } from '../utils/actions'
import { openPluginSettings } from '../utils/alerts'
import { messageOf, showErrorToast } from '../utils/repos'
import {
    showBrowsePluginActionSheet,
    showPluginOptionsActionSheet,
} from '../utils/sheets'
import { PluginIcon } from './PluginIcon'
import { usePluginEnabled } from './PluginStateProvider'
import { PluginTooltip, usePluginTooltip } from './TooltipProvider'
import type { AnyPlugin, InternalPluginMeta } from '@revenge-mod/plugins/_'
import type { RepoPluginListing } from '@revenge-mod/plugins/_/repositories'

const { Card, Text, Stack, IconButton, Button, createStyles } = Design

const SettingsIcon = getAssetIdByName('SettingsIcon', 'png')!
const MoreVerticalIcon = getAssetIdByName('MoreVerticalIcon', 'png')!
const DownloadIcon = getAssetIdByName('DownloadIcon', 'png')!

export const PLUGIN_CARD_ESTIMATED_SIZE = 116

export const PLUGIN_CARD_HALF_GUTTER = 6

export const PluginCard = memo(function PluginCard({
    name,
    description,
    version,
    author,
    icon,
    actions,
}: {
    name: string
    description: string
    version: string
    author: string
    icon?: string
    actions?: React.ReactNode
}) {
    const styles_ = usePluginCardStyles()

    return (
        <Card style={[styles_.card, styles.grow]}>
            <PluginInfo
                name={name}
                description={description}
                author={author}
                icon={icon}
                actions={actions}
                version={version}
                aligned
            />
        </Card>
    )
})

export const PluginInfo = memo(function PluginInfo({
    name,
    description,
    author,
    version,
    icon,
    actions,
    aligned,
}: {
    name: string
    description: string
    author: string
    version: string
    icon?: string
    actions?: React.ReactNode
    aligned?: boolean
}) {
    const styles_ = usePluginCardStyles()

    return (
        <Stack>
            <Stack
                direction="horizontal"
                style={[styles.grow, styles_.topContainer]}
            >
                <Stack
                    direction="horizontal"
                    spacing={8}
                    style={[styles_.topContainer, styles.flex]}
                >
                    <PluginIcon icon={icon} />
                    <Text
                        variant="heading-lg/semibold"
                        textBreakStrategy="balanced"
                        style={styles.flex}
                    >
                        {name}
                    </Text>
                </Stack>
                {actions}
            </Stack>
            <Stack
                spacing={4}
                style={[aligned && styles_.alignedContainer, styles.grow]}
            >
                <Text
                    color="text-muted"
                    style={styles.grow}
                    variant="heading-md/medium"
                >
                    by {author}
                    {version ? ` \u2022 ${version}` : ''}
                </Text>
                <Text style={styles.grow} variant="text-md/medium">
                    {description}
                </Text>
            </Stack>
        </Stack>
    )
})

export const InstalledPluginCard = memo(function InstalledPluginCard({
    plugin,
    meta,
}: {
    plugin: AnyPlugin
    meta: InternalPluginMeta
}) {
    const enabled = usePluginEnabled(plugin)
    const savedEnabled = isPluginEnabledInSavedStates(plugin)

    const {
        manifest: { name, description, version, author, icon },
    } = plugin

    const essential = isPluginEssential(meta)
    const startable = isPluginStartable(plugin)
    const pendingUpdate = isPluginPendingUpdate(plugin)

    const toggleDisabled = essential || pendingUpdate

    const [settingsRef, showEnableTooltip] = usePluginTooltip(
        PluginTooltip.Enable,
    )

    const [switchRef, showToggleTooltip] = usePluginTooltip(
        essential ? PluginTooltip.Essential : PluginTooltip.PendingUpdate,
    )

    return (
        <PluginCard
            name={name}
            description={description}
            version={formatVersion(version)}
            author={author}
            icon={icon}
            actions={
                <>
                    <IconButton
                        size="sm"
                        variant="secondary"
                        icon={MoreVerticalIcon}
                        onPress={() => {
                            showPluginOptionsActionSheet(plugin)
                        }}
                    />
                    {plugin.SettingsComponent && (
                        <Pressable
                            onPress={() => {
                                if (!startable) showEnableTooltip()
                            }}
                        >
                            <IconButton
                                ref={settingsRef}
                                size="sm"
                                variant="secondary"
                                icon={SettingsIcon}
                                disabled={!startable}
                                onPress={() => {
                                    openPluginSettings(plugin)
                                }}
                            />
                        </Pressable>
                    )}
                    <Pressable
                        onPress={() => {
                            if (toggleDisabled) showToggleTooltip()
                        }}
                        ref={switchRef}
                    >
                        <InstalledPluginSwitch
                            plugin={plugin}
                            enabled={enabled}
                            savedEnabled={savedEnabled}
                            toggleDisabled={toggleDisabled}
                        />
                    </Pressable>
                </>
            }
        />
    )
})

export const InstalledPluginSwitch = memo(function InstalledPluginSwitch({
    plugin,
    enabled,
    savedEnabled,
    toggleDisabled,
}: {
    plugin: AnyPlugin
    enabled: boolean
    savedEnabled: boolean
    toggleDisabled: boolean
}) {
    return (
        <FormSwitch
            key={plugin.manifest.id}
            disabled={toggleDisabled}
            onValueChange={enabled => {
                ;(enabled
                    ? handleEnablePlugin(plugin)
                    : handleDisablePlugin(plugin)
                ).catch(e => showErrorToast(messageOf(e)))
            }}
            value={isDefaultsOnlyBoot ? savedEnabled : enabled}
        />
    )
})

/**
 * Card for a plugin that isn't installed yet, shown on the Browse screen.
 * No switch or settings button, just a more menu and a small Install button.
 */
export const BrowsePluginCard = memo(function BrowsePluginCard({
    name,
    description,
    version,
    author,
    icon,
    id,
    listing,
    channel,
    repositoryText,
    onInstall,
}: {
    name: string
    description: string
    version: string
    author: string
    icon?: string
    id: string
    listing: RepoPluginListing
    channel: string
    repositoryText: string
    onInstall: (channel?: string, version?: string) => void
}) {
    return (
        <PluginCard
            name={name}
            description={description}
            version={version}
            author={author}
            icon={icon}
            actions={
                <>
                    <IconButton
                        size="sm"
                        variant="secondary"
                        icon={MoreVerticalIcon}
                        onPress={() => {
                            showBrowsePluginActionSheet({
                                name,
                                author,
                                description,
                                version,
                                icon,
                                id,
                                listing,
                                channel,
                                repositoryText,
                                onInstall,
                            })
                        }}
                    />
                    <Button
                        size="sm"
                        text="Install"
                        icon={DownloadIcon}
                        onPress={onInstall}
                    />
                </>
            }
        />
    )
})

const usePluginCardStyles = createStyles({
    card: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 4,
        margin: PLUGIN_CARD_HALF_GUTTER,
    },
    topContainer: {
        alignItems: 'center',
    },
    alignedContainer: {
        paddingLeft: 28,
    },
})
