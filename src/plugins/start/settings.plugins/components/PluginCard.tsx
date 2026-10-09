import { getAssetIdByName } from '@revenge-mod/assets'
import { styles } from '@revenge-mod/components/_'
import FormSwitch from '@revenge-mod/components/FormSwitch'
import { Tokens } from '@revenge-mod/discord/common/tokens'
import { Design } from '@revenge-mod/discord/design'
import {
    getInternalPluginMeta,
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
    usePluginSource,
    usePluginStatus,
} from '@revenge-mod/plugins/_/react'
import { parsePluginContributor } from '@revenge-mod/plugins/utils'
import { memo, useCallback, useMemo, useState } from 'react'
import { Image, Pressable, View } from 'react-native'
import { handleDisablePlugin, handleEnablePlugin } from '../utils/actions'
import { openPluginSettings, showErrorToast } from '../utils/alerts'
import {
    showBrowsePluginActionSheet,
    showPluginContributorsActionSheet,
    showPluginOptionsActionSheet,
} from '../utils/sheets'
import { messageOf, pluralize } from '../utils/strings'
import Pill from './Pill'
import { PluginIcon } from './PluginIcon'
import { PluginTooltip, usePluginTooltip } from './TooltipProvider'
import type { AnyPlugin, InternalPluginMeta } from '@revenge-mod/plugins/_'
import type { ReactNode } from 'react'
import type { PluginRef } from '../utils/repos'
import type { BrowseEntry } from './PluginList'

const { Card, Text, Stack, IconButton, Button, createStyles } = Design

const SettingsIcon = getAssetIdByName('SettingsIcon', 'png')!
const DownloadIcon = getAssetIdByName('DownloadIcon', 'png')!

export const PLUGIN_CARD_ESTIMATED_SIZE = 116

export const PLUGIN_CARD_HALF_GUTTER = 6

export interface PluginInfoData {
    name: string
    description: string
    icon?: string | null
    /** Only for plugins about to be installed, installed ones are kept up to date. */
    version?: string
    /** Download size, shown on the title row along with {@link version}. */
    size?: string
    /** Repository it comes from, shown under the author. */
    repository?: string
    /** Turns {@link version} and {@link size} into a pill that changes the version. */
    onPressVersion?: () => void
    /** Turns {@link repository} into a pill that changes the repository. */
    onPressRepository?: () => void
}

export interface PluginInfoProps {
    info: PluginInfoData
    author?: ReactNode
    extraInfo?: ReactNode
    actions?: ReactNode
    /** Shown under the description. */
    footer?: ReactNode
    aligned?: boolean
}

export interface PluginCardProps
    extends Omit<PluginInfoProps, 'author' | 'aligned'> {
    onPress?: () => void
    accessibilityHint?: string
}

const CardRipple = { borderless: false }

export const PluginCard = memo(function PluginCard({
    onPress,
    accessibilityHint,
    ...props
}: PluginCardProps) {
    const styles_ = usePluginCardStyles()
    const info = <PluginInfo {...props} aligned />

    return (
        <Card style={[styles_.card, styles.grow]}>
            {onPress ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={props.info.name}
                    accessibilityHint={accessibilityHint}
                    android_ripple={CardRipple}
                    style={[styles_.cardContent, styles.grow]}
                    onPress={onPress}
                >
                    {info}
                </Pressable>
            ) : (
                <View style={[styles_.cardContent, styles.grow]}>{info}</View>
            )}
        </Card>
    )
})

export const PluginInfoStatusIcon = memo(function PluginInfoStatusIcon({
    plugin,
}: {
    plugin: AnyPlugin
}) {
    const styles_ = usePluginCardStyles()
    const meta = getInternalPluginMeta(plugin)

    usePluginFlags(plugin)
    usePluginStatus(plugin)
    usePluginSource(plugin)

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
            key: 'updatePaused',
            text: 'Updates are paused for this plugin.',
            condition: meta.source?.held === true,
            source: getAssetIdByName('PauseIcon')!,
            extraStyles: [styles_.iconWarning],
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
            source: getAssetIdByName('HandRequestSpeakIcon')!,
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

const GlobeEarthIcon = getAssetIdByName('GlobeEarthIcon', 'png')!

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
                color="text-subtle"
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
                variant="heading-md/medium"
                style={styles_.authorClickableText}
            >
                {parsed.name}
                {count ? `, ${pluralize(count, 'contributor')}` : ''}
            </Text>
        </Pressable>
    )
})

export const PluginInfo = memo(function PluginInfo({
    info: {
        name,
        description,
        icon,
        version,
        size,
        repository,
        onPressVersion,
        onPressRepository,
    },
    author,
    extraInfo,
    actions,
    footer,
    aligned,
}: PluginInfoProps) {
    const styles_ = usePluginCardStyles()

    return (
        <Stack spacing={6}>
            <Stack
                direction="horizontal"
                style={[styles.grow, styles_.topContainer]}
            >
                <Stack
                    direction="horizontal"
                    spacing={8}
                    style={[styles_.topContainer, styles.flex]}
                >
                    <PluginIcon icon={icon ?? undefined} />
                    <Text
                        variant="heading-lg/semibold"
                        color="text-strong"
                        textBreakStrategy="balanced"
                        style={styles.flex}
                    >
                        {name}
                    </Text>
                </Stack>
                {extraInfo}
                {size &&
                    (onPressVersion ? (
                        <Pill
                            label={version ? `${version} \u2022 ${size}` : size}
                            accessibilityLabel={`Change version of ${name}`}
                            onPress={onPressVersion}
                        />
                    ) : (
                        <Text color="text-subtle" variant="text-sm/medium">
                            {version ? `${version} \u2022 ${size}` : size}
                        </Text>
                    ))}
                {actions}
            </Stack>
            <Stack
                spacing={4}
                style={[aligned && styles_.alignedContainer, styles.grow]}
            >
                {author ? (
                    <Stack
                        direction="horizontal"
                        spacing={0}
                        align="baseline"
                        style={[styles_.byline, styles.grow]}
                    >
                        <Text color="text-subtle" variant="heading-md/medium">
                            by{' '}
                        </Text>
                        {author}
                        {version && !size ? (
                            <Text
                                color="text-subtle"
                                variant="heading-md/medium"
                            >
                                {` \u2022 ${version}`}
                            </Text>
                        ) : null}
                    </Stack>
                ) : (
                    version &&
                    !size && (
                        <Text color="text-subtle" variant="heading-md/medium">
                            {version}
                        </Text>
                    )
                )}
                {repository &&
                    (onPressRepository ? (
                        <View style={styles_.pillRow}>
                            <Pill
                                label={repository}
                                icon={GlobeEarthIcon}
                                accessibilityLabel={`Change repository of ${name}`}
                                onPress={onPressRepository}
                            />
                        </View>
                    ) : (
                        <Stack
                            direction="horizontal"
                            spacing={4}
                            align="center"
                        >
                            <Image
                                source={GlobeEarthIcon}
                                style={styles_.repositoryIcon}
                            />
                            <Text
                                color="text-subtle"
                                variant="text-sm/medium"
                                lineClamp={1}
                            >
                                {repository}
                            </Text>
                        </Stack>
                    ))}
                <Text style={styles.grow} variant="text-md/medium">
                    {description}
                </Text>
                {footer}
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
        manifest: { name, description, icon },
    } = plugin

    // So the memoized card skips re-rendering when only the slots change
    const info = useMemo(
        () => ({ name, description, icon }),
        [name, description, icon],
    )

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
            info={info}
            extraInfo={<PluginInfoStatusIcon plugin={plugin} />}
            accessibilityHint="Opens plugin options"
            onPress={() => {
                showPluginOptionsActionSheet(plugin)
            }}
            actions={
                <>
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
    entry,
    onInstall,
}: {
    entry: BrowseEntry
    onInstall: (id: string, repo: string, ref: PluginRef) => Promise<unknown>
}) {
    const [installing, setInstalling] = useState(false)
    const { listing } = entry

    const install = useCallback(
        (repo: string, ref: PluginRef) => {
            setInstalling(true)
            onInstall(listing.id, repo, ref).finally(() => setInstalling(false))
        },
        [onInstall, listing.id],
    )

    const showSheet = () => {
        showBrowsePluginActionSheet({ entry, onInstall: install })
    }

    return (
        <PluginCard
            info={listing}
            accessibilityHint="Opens install options"
            onPress={showSheet}
            actions={
                <Button
                    size="sm"
                    text="Install"
                    icon={DownloadIcon}
                    loading={installing}
                    disabled={installing}
                    accessibilityHint="Long press for install options"
                    onPress={() =>
                        install(entry.repoUrl, {
                            type: 'channel',
                            channel: entry.channel,
                        })
                    }
                    onLongPress={showSheet}
                />
            }
        />
    )
})

const usePluginCardStyles = createStyles({
    card: {
        padding: 0,
        margin: PLUGIN_CARD_HALF_GUTTER,
        // Clips the ripple
        overflow: 'hidden',
    },
    cardContent: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 4,
    },
    topContainer: {
        alignItems: 'center',
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
    repositoryIcon: {
        tintColor: Tokens.default.colors.TEXT_MUTED,
        width: 14,
        height: 14,
    },
    pillRow: {
        flexDirection: 'row',
    },
})
