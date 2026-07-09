import { getAssetIdByName } from '@revenge-mod/assets'
import { styles } from '@revenge-mod/components/_'
import FormSwitch from '@revenge-mod/components/FormSwitch'
import { Tokens } from '@revenge-mod/discord/common'
import { Design } from '@revenge-mod/discord/design'
import {
    isPluginEssential,
    isPluginPendingUpdate,
    isPluginStartable,
} from '@revenge-mod/plugins/_'
import { memo } from 'react'
import { Image, Pressable } from 'react-native'
import { handleDisablePlugin, handleEnablePlugin } from '../utils/actions'
import { openPluginSettings } from '../utils/alerts'
import { showPluginOptionsActionSheet } from '../utils/sheets'
import { usePluginEnabled } from './PluginStateProvider'
import {
    useClickOutsideTooltip,
    useEnablePluginTooltip,
    useEssentialPluginTooltip,
} from './TooltipProvider'
import type { AnyPlugin, InternalPluginMeta } from '@revenge-mod/plugins/_'

const { Card, Text, Stack, IconButton, createStyles } = Design

const PuzzlePieceIcon = getAssetIdByName('PuzzlePieceIcon', 'png')!
const SettingsIcon = getAssetIdByName('SettingsIcon', 'png')!
const MoreVerticalIcon = getAssetIdByName('MoreVerticalIcon', 'png')!

export const PLUGIN_CARD_ESTIMATED_SIZE = 116

export const PluginCard = memo(function PluginCard({
    name,
    description,
    author,
    icon,
    actions,
    rowEnd,
    columnEnd,
}: {
    name: string
    description: string
    author: string
    icon?: string
    actions?: React.ReactNode
    rowEnd?: boolean
    columnEnd?: boolean
}) {
    const styles_ = usePluginCardStyles()

    return (
        <Card
            style={[
                styles_.card,
                styles.grow,
                columnEnd && styles_.columnEnd,
                rowEnd && styles_.rowEnd,
            ]}
        >
            <PluginInfo
                name={name}
                description={description}
                author={author}
                icon={icon}
                actions={actions}
                aligned
            />
        </Card>
    )
})

export const PluginInfo = memo(function PluginInfo({
    name,
    description,
    author,
    icon,
    actions,
    aligned,
}: {
    name: string
    description: string
    author: string
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
                    <Image
                        source={icon ? getAssetIdByName(icon) : PuzzlePieceIcon}
                        style={styles_.icon}
                    />
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
    rowEnd,
    columnEnd,
}: {
    plugin: AnyPlugin
    meta: InternalPluginMeta
    rowEnd?: boolean
    columnEnd?: boolean
}) {
    const enabled = usePluginEnabled(plugin)

    const {
        manifest: { name, description, author, icon },
    } = plugin

    const essential = isPluginEssential(meta)
    const startable = isPluginStartable(plugin)
    const pendingUpdate = isPluginPendingUpdate(plugin)

    const toggleDisabled = essential || pendingUpdate

    const enableTooltip = useEnablePluginTooltip()
    const essentialTooltip = useEssentialPluginTooltip()

    const settingsRef = useClickOutsideTooltip(useEnablePluginTooltip, () => {})

    const switchRef = useClickOutsideTooltip(
        useEssentialPluginTooltip,
        () => {},
    )

    return (
        <PluginCard
            name={name}
            description={description}
            author={author}
            icon={icon}
            rowEnd={rowEnd}
            columnEnd={columnEnd}
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
                                if (!startable)
                                    requestAnimationFrame(() => {
                                        enableTooltip.targetRef.current =
                                            settingsRef.current
                                        enableTooltip.setVisible(true)
                                    })
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
                            if (toggleDisabled)
                                requestAnimationFrame(() => {
                                    essentialTooltip.targetRef.current =
                                        switchRef.current
                                    essentialTooltip.setVisible(true)
                                })
                        }}
                        ref={switchRef}
                    >
                        <FormSwitch
                            key={plugin.manifest.id}
                            disabled={toggleDisabled}
                            onValueChange={enabled => {
                                if (enabled) handleEnablePlugin(plugin)
                                else handleDisablePlugin(plugin)
                            }}
                            value={enabled}
                        />
                    </Pressable>
                </>
            }
        />
    )
})

const usePluginCardStyles = createStyles({
    icon: {
        width: 20,
        height: 20,
        tintColor: Tokens.default.colors.TEXT_DEFAULT,
    },
    card: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        gap: 4,
        marginBottom: 12,
        marginRight: 12,
    },
    rowEnd: {
        marginBottom: 0,
    },
    columnEnd: {
        marginRight: 0,
    },
    topContainer: {
        alignItems: 'center',
    },
    alignedContainer: {
        paddingLeft: 28,
    },
})
