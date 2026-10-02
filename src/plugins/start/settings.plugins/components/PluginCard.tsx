import { getAssetIdByName } from '@revenge-mod/assets'
import { styles } from '@revenge-mod/components/_'
import FormSwitch from '@revenge-mod/components/FormSwitch'
import { Tokens } from '@revenge-mod/discord/common/tokens'
import { Design } from '@revenge-mod/discord/design'
import {
    isPluginEnabled,
    isPluginErrored,
    isPluginEssential,
    isPluginFailed,
    isPluginPendingReload,
    isPluginPendingUpdate,
    isPluginStarted,
    isPluginStartedLate,
    isPluginStopped,
} from '@revenge-mod/plugins/_'
import {
    usePluginEnabledInActiveSlot,
    usePluginFlags,
    usePluginStatus,
} from '@revenge-mod/plugins/_/react'
import {
    formatVersion,
    parsePluginContributor,
} from '@revenge-mod/plugins/utils'
import { memo, useCallback, useState } from 'react'
import { Image, Pressable } from 'react-native'
import { handleDisablePlugin, handleEnablePlugin } from '../utils/actions'
import { openPluginSettings } from '../utils/alerts'
import { messageOf, showErrorToast } from '../utils/repos'
import {
    showBrowsePluginActionSheet,
    showPluginContributorsActionSheet,
    showPluginOptionsActionSheet,
} from '../utils/sheets'
import { PluginIcon } from './PluginIcon'
import { PluginTooltip, usePluginTooltip } from './TooltipProvider'
import type { AnyPlugin, InternalPluginMeta } from '@revenge-mod/plugins/_'
import type { RepoPluginListing } from '@revenge-mod/plugins/_/repositories'
import type { ReactNode } from 'react'

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
    contributors,
    icon,
    extraInfo,
    actions,
}: {
    name: string
    description: string
    version: string
    author: string
    contributors?: string[]
    icon?: string
    extraInfo?: React.ReactNode
    actions?: React.ReactNode
}) {
    const styles_ = usePluginCardStyles()

    return (
        <Card style={[styles_.card, styles.grow]}>
            <PluginInfo
                name={name}
                description={description}
                author={
                    <PluginAuthor
                        pluginName={name}
                        author={author}
                        contributors={contributors}
                    />
                }
                icon={icon}
                extraInfo={extraInfo}
                actions={actions}
                version={version}
                aligned
            />
        </Card>
    )
})

export const PluginInfoStatusIcon = memo(function PluginInfoStatusIcon({
    plugin,
}: {
    plugin: AnyPlugin
}) {
    const styles_ = usePluginCardStyles()

    usePluginFlags(plugin)
    usePluginStatus(plugin)

    const icons = [
        {
            key: 'reload',
            text: 'This plugin requires a reload to apply changes.',
            condition: isPluginPendingReload(plugin),
            source: getAssetIdByName('RetryIcon')!,
            extraStyles: [],
        },
        {
            key: 'update',
            text: 'This plugin requires a reload to apply an update.',
            condition: isPluginPendingUpdate(plugin),
            source: getAssetIdByName('RefreshIcon')!,
            extraStyles: [],
        },
        {
            key: 'error',
            text: 'This plugin has an error.',
            condition: isPluginErrored(plugin) || isPluginFailed(plugin),
            source: getAssetIdByName('CircleErrorIcon')!,
            extraStyles: [styles_.iconError],
        },
        {
            key: 'stopped',
            text: 'This plugin is stopped.',
            condition:
                isPluginEnabled(plugin) &&
                !isPluginStartedLate(plugin) &&
                isPluginStopped(plugin),
            source: getAssetIdByName('PauseIcon')!,
            extraStyles: [styles_.iconWarning],
        },
    ].filter(it => it.condition)

    return icons.map(icon => (
        <Image
            key={icon.key}
            source={icon.source}
            style={[styles_.icon, ...icon.extraStyles]}
        />
    ))
})

const AuthorRipple = { borderless: false }

export const PluginAuthor = memo(function PluginAuthor({
    pluginName,
    author,
    contributors = [],
}: {
    pluginName: string
    author: string
    contributors?: string[]
}) {
    const styles_ = usePluginCardStyles()
    const parsed = parsePluginContributor(author)

    if (
        !parsed ||
        !(parsed.ids.length || parsed.links.length || contributors.length)
    )
        return (
            <Text
                color="text-muted"
                style={styles_.author}
                variant="heading-md/medium"
            >
                {parsed?.name ?? author}
            </Text>
        )

    const count = contributors.length

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityHint="Shows contacts of the author and contributors"
            android_ripple={AuthorRipple}
            style={styles_.author}
            onPress={() =>
                showPluginContributorsActionSheet({
                    pluginName,
                    author,
                    contributors,
                })
            }
        >
            <Text
                color="text-muted"
                variant="heading-md/medium"
                style={styles_.authorClickableText}
            >
                {parsed.name}
                {count ? `, ${count} contributor${count === 1 ? '' : 's'}` : ''}
            </Text>
        </Pressable>
    )
})

export const PluginInfo = memo(function PluginInfo({
    name,
    description,
    author,
    version,
    icon,
    extraInfo,
    actions,
    aligned,
}: {
    name: string
    description: string
    author: ReactNode
    version: string
    icon?: string
    extraInfo?: React.ReactNode
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
                {extraInfo}
                {actions}
            </Stack>
            <Stack
                spacing={4}
                style={[aligned && styles_.alignedContainer, styles.grow]}
            >
                <Stack
                    direction="horizontal"
                    spacing={0}
                    align="baseline"
                    style={[styles_.byline, styles.grow]}
                >
                    <Text color="text-muted" variant="heading-md/medium">
                        by{' '}
                    </Text>
                    {author}
                    {version ? (
                        <Text color="text-muted" variant="heading-md/medium">
                            {` \u2022 ${version}`}
                        </Text>
                    ) : null}
                </Stack>
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
    const savedEnabled = usePluginEnabledInActiveSlot(plugin)

    const {
        manifest: { name, description, version, author, contributors, icon },
    } = plugin

    usePluginFlags(plugin)
    usePluginStatus(plugin)

    const essential = isPluginEssential(meta)
    const started = isPluginStarted(plugin)
    const pendingUpdate = isPluginPendingUpdate(plugin)

    const toggleDisabled = essential || pendingUpdate

    const [settingsRef, showStartTooltip] = usePluginTooltip(
        PluginTooltip.Start,
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
            contributors={contributors}
            icon={icon}
            extraInfo={<PluginInfoStatusIcon plugin={plugin} />}
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
                                if (!started) showStartTooltip()
                            }}
                        >
                            <IconButton
                                ref={settingsRef}
                                size="sm"
                                variant="secondary"
                                icon={SettingsIcon}
                                disabled={!started}
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
                            enabled={savedEnabled}
                            toggleDisabled={toggleDisabled}
                        />
                    </Pressable>
                </>
            }
        />
    )
})

/** The switch answers for the slot the user chose, since that is what toggling it writes. */
export const InstalledPluginSwitch = memo(function InstalledPluginSwitch({
    plugin,
    enabled,
    toggleDisabled,
}: {
    plugin: AnyPlugin
    enabled: boolean
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
            value={enabled}
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
    onInstall: (channel?: string, version?: string) => Promise<unknown>
}) {
    const [installing, setInstalling] = useState(false)

    const install = useCallback(() => {
        const result = onInstall()
        setInstalling(true)
        result.finally(() => setInstalling(false))
    }, [onInstall])

    return (
        <PluginCard
            name={name}
            description={description}
            version={version}
            author={author}
            contributors={listing.contributors}
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
                                onInstall: install,
                            })
                        }}
                    />
                    <Button
                        size="sm"
                        text="Install"
                        icon={DownloadIcon}
                        loading={installing}
                        disabled={installing}
                        onPress={install}
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
        minHeight: 32,
    },
    alignedContainer: {
        paddingLeft: 28,
    },
    byline: {
        flexWrap: 'wrap',
    },
    author: {
        flexShrink: 1,
    },
    authorClickableText: {
        color: Tokens.default.colors.TEXT_BRAND,
        fontWeight: 'bold',
    },
    icon: {
        tintColor: Tokens.default.colors.TEXT_BRAND,
        width: 20,
        height: 20,
    },
    iconWarning: {
        tintColor: Tokens.default.colors.TEXT_FEEDBACK_WARNING,
    },
    iconError: {
        tintColor: Tokens.default.colors.TEXT_FEEDBACK_CRITICAL,
    },
})
