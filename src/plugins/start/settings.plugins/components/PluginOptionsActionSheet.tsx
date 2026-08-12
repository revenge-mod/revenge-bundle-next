import { getAssetIdByName } from '@revenge-mod/assets'
import { TableRowAssetIcon } from '@revenge-mod/components'
import {
    ActionSheetActionCreators,
    ToastActionCreators,
} from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { Clipboard } from '@revenge-mod/externals/react-native-clipboard'
import {
    formatPluginError,
    getInternalPluginMeta,
    getPluginDependencies,
    getPluginDependents,
    InternalPluginFlags,
    isDefaultsOnlyBoot,
    isPluginEnabledInSavedStates,
    isPluginEssential,
    isPluginInternal,
    isPluginPendingUpdate,
    isPluginStartable,
    PluginFlags,
    pList,
    runPluginLate,
    stopPlugin,
} from '@revenge-mod/plugins/_'
import {
    listRepoPlugins,
    listRepos,
    refreshRepo,
} from '@revenge-mod/plugins/_/repositories'
import { PluginStatus } from '@revenge-mod/plugins/constants'
import { formatVersion } from '@revenge-mod/plugins/utils'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { useEffect, useState } from 'react'
import { Pressable } from 'react-native'
import { ClickOutsideProvider } from 'react-native-click-outside'
import {
    openPluginSettings,
    showPluginClearDataConfirmation,
    showPluginUninstallConfirmation,
} from '../utils/alerts'
import { messageOf, runInstallFlow, showErrorToast } from '../utils/repos'
import { InstalledPluginSwitch, PluginInfo } from './PluginCard'
import { usePluginEnabled, usePluginStatus } from './PluginStateProvider'
import PluginTooltipsProvider, {
    PluginTooltip,
    usePluginTooltip,
} from './TooltipProvider'
import type { AnyPlugin } from '@revenge-mod/plugins/_'
import type { RepoPluginListing } from '@revenge-mod/plugins/_/repositories'

export interface PluginOptionsActionSheetProps {
    plugin: AnyPlugin
    sheetKey: string
}

const {
    ActionSheet,
    IconButton,
    TableRowGroup,
    TableRow,
    TableRadioGroup,
    TableRadioRow,
    Stack,
} = Design

const FileWarningIcon = getAssetIdByName('FileWarningIcon', 'png')!
const PlayIcon = getAssetIdByName('PlayIcon', 'png')!
const SettingsIcon = getAssetIdByName('SettingsIcon', 'png')!
const StopIcon = getAssetIdByName('StopIcon', 'png')!
const TrashIcon = getAssetIdByName('TrashIcon', 'png')!

export default function PluginOptionsActionSheet({
    plugin,
    sheetKey,
}: PluginOptionsActionSheetProps) {
    return (
        <ActionSheet>
            <ClickOutsideProvider>
                <PluginTooltipsProvider>
                    <PluginOptions plugin={plugin} sheetKey={sheetKey} />
                </PluginTooltipsProvider>
            </ClickOutsideProvider>
        </ActionSheet>
    )
}

function PluginOptions({ plugin, sheetKey }: PluginOptionsActionSheetProps) {
    const enabled = usePluginEnabled(plugin)
    const meta = getInternalPluginMeta(plugin)
    const essential = isPluginEssential(meta)
    const pendingUpdate = isPluginPendingUpdate(plugin)
    const { name, author, description, icon, version } = plugin.manifest

    const [switchRef, showPendingUpdateTooltip] = usePluginTooltip(
        PluginTooltip.PendingUpdate,
    )

    return (
        <Stack spacing={24} style={{ paddingTop: 8 }}>
            <PluginInfo
                name={name}
                author={author}
                version={formatVersion(version)}
                description={description}
                icon={icon}
                actions={
                    !essential && (
                        <Pressable
                            onPress={() => {
                                if (pendingUpdate) showPendingUpdateTooltip()
                            }}
                            ref={switchRef}
                        >
                            <InstalledPluginSwitch
                                enabled={enabled}
                                plugin={plugin}
                                savedEnabled={isPluginEnabledInSavedStates(
                                    plugin,
                                )}
                                toggleDisabled={pendingUpdate}
                            />
                        </Pressable>
                    )
                }
            />
            <PluginActions
                plugin={plugin}
                closeSheet={() => {
                    ActionSheetActionCreators.hideActionSheet(sheetKey)
                }}
            />
            <StatusSection plugin={plugin} />
            <AdvancedSection plugin={plugin} sheetKey={sheetKey} />
        </Stack>
    )
}

function StatusSection({ plugin }: { plugin: AnyPlugin }) {
    const status = usePluginStatus(plugin)
    const meta = getInternalPluginMeta(plugin)
    const errors = [...plugin.errors, ...meta.nativeErrors]

    return (
        <TableRowGroup title="Status">
            <TableRow
                icon={<TableRowAssetIcon name="CircleInformationIcon" />}
                label="Status"
                subLabel={bitFieldToString(PluginStatus, status)}
            />
            {errors.length > 0 && (
                <TableRow
                    variant="danger"
                    label="Errors"
                    icon={
                        <TableRowAssetIcon
                            variant="danger"
                            name="CircleErrorIcon"
                        />
                    }
                    subLabel={`${errors.length} errors. Tap to copy.`}
                    onPress={() => {
                        Clipboard.setString(
                            errors.map(formatPluginError).join('\n\n'),
                        )
                        showCopiedToClipboardToast()
                    }}
                />
            )}
        </TableRowGroup>
    )
}

function ChannelSection({
    plugin,
    sheetKey,
}: {
    plugin: AnyPlugin
    sheetKey: string
}) {
    const meta = getInternalPluginMeta(plugin)
    const source = meta.source
    if (isPluginInternal(meta) || !source?.repo) return null

    const [listing, setListing] = useState<RepoPluginListing | null>(null)
    const [resetKey, setResetKey] = useState(0)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const listings = await listRepoPlugins(source.repo)
                const found = listings.find(l => l.id === plugin.manifest.id)
                if (found && !cancelled) setListing(found)
            } catch {
                try {
                    await refreshRepo(source.repo)
                    const listings = await listRepoPlugins(source.repo)
                    const found = listings.find(l => l.id === plugin.manifest.id)
                    if (found && !cancelled) setListing(found)
                } catch {}
            }
        })()
        return () => {
            cancelled = true
        }
    }, [source.repo, plugin.manifest.id])

    if (!listing || Object.keys(listing.channels).length === 0) return null

    const handleChange = async (selected: string) => {
        if (selected === source.channel) return

        const targetVersion = listing.channels[selected]
        if (!targetVersion) return

        if (targetVersion === plugin.manifest.version) {
            setResetKey(k => k + 1)
            ToastActionCreators.open({
                key: 'REVENGE_PLUGIN_CHANNEL_UP_TO_DATE',
                content: 'This channel is already installed',
                IconComponent: () => <TableRowAssetIcon name="CircleCheckIcon" />,
            })
            return
        }

        const repos = await listRepos()
        const internalUrls = repos
            .filter(r => r.internal)
            .map(r => r.url)

        ActionSheetActionCreators.hideActionSheet(sheetKey)
        runInstallFlow(
            plugin.manifest.id,
            undefined,
            selected,
            [...internalUrls, source.repo],
        )
    }

    return (
        <TableRadioGroup
            key={resetKey}
            title="Channel"
            defaultValue={source.channel}
            onChange={v => handleChange(v as string)}
        >
            {Object.keys(listing.channels).map(c => (
                <TableRadioRow key={c} label={c} value={c} />
            ))}
        </TableRadioGroup>
    )
}

function AdvancedSection({
    plugin,
    sheetKey,
}: {
    plugin: AnyPlugin
    sheetKey: string
}) {
    const meta = getInternalPluginMeta(plugin)
    const dependents = getPluginDependents(plugin, true)
    const dependencies = getPluginDependencies(plugin, false)
    const repositoryText = usePluginRepositoryText(plugin)
    const { id, name } = plugin.manifest

    return (
        <>
            <ChannelSection plugin={plugin} sheetKey={sheetKey} />
            <TableRowGroup title="Advanced">
                <IdRow id={id} />
                <RepositoryRow
                    text={repositoryText}
                    copyable={!!meta.source?.repo}
                />
                <TableRow
                    icon={<TableRowAssetIcon name="FlagIcon" />}
                    label="Flags"
                    subLabel={bitFieldToString(PluginFlags, meta.flags)}
                />
                {meta.iflags > 0 && (
                    <TableRow
                        icon={<TableRowAssetIcon name="FlagIcon" />}
                        label="Internal Flags"
                        subLabel={bitFieldToString(
                            InternalPluginFlags,
                            meta.iflags,
                        )}
                    />
                )}
                {dependencies.length > 0 && (
                    <TableRow
                        icon={<TableRowAssetIcon name="ListBulletsIcon" />}
                        label="Dependencies"
                        subLabel={`${name} depends on ${dependencies.length} other plugins`}
                        onPress={() => {
                            ActionSheetActionCreators.openLazy(
                                import('./PluginRelationsListActionSheet'),
                                `plugin-deps-${id}`,
                                {
                                    title: `Dependencies of ${name}`,
                                    unsatisfiedTitle: `Unsatisfied dependencies of ${name}`,
                                    unsatisfiedPlugins:
                                        meta.unsatisfiedOptionalDependencies.map(
                                            id => pList.get(id) ?? id,
                                        ),
                                    plugins: dependencies,
                                    dependencyMap: plugin.manifest.dependencies!,
                                },
                                'stack',
                            )
                        }}
                    />
                )}
                {dependents.length > 0 && (
                    <TableRow
                        icon={<TableRowAssetIcon name="ListBulletsIcon" />}
                        label="Dependents"
                        subLabel={`${dependents.length} other plugins depend on ${name}`}
                        onPress={() => {
                            ActionSheetActionCreators.openLazy(
                                import('./PluginRelationsListActionSheet'),
                                `plugin-dependents-${id}`,
                                {
                                    title: `Dependents of ${name}`,
                                    plugins: dependents,
                                },
                                'stack',
                            )
                        }}
                    />
                )}
            </TableRowGroup>
        </>
    )
}

function bitFieldToString(map: Record<string, number>, bitField: number) {
    return (
        Object.entries(map)
            .filter(([, value]) => bitField & value)
            .map(([key]) => key)
            .join(', ') || '-'
    )
}

export function IdRow({ id }: { id: string }) {
    return (
        <TableRow
            icon={<TableRowAssetIcon name="IdIcon" />}
            label="ID"
            subLabel={id}
            onPress={() => {
                Clipboard.setString(id)
                showCopiedToClipboardToast()
            }}
        />
    )
}

export function RepositoryRow({
    text,
    copyable,
}: {
    text: string
    copyable?: boolean
}) {
    return (
        <TableRow
            icon={<TableRowAssetIcon name="GlobeEarthIcon" />}
            label="Repository"
            subLabel={text}
            onPress={
                copyable
                    ? () => {
                          Clipboard.setString(text)
                          showCopiedToClipboardToast()
                      }
                    : undefined
            }
        />
    )
}

function usePluginRepositoryText(plugin: AnyPlugin) {
    const meta = getInternalPluginMeta(plugin)
    const internal = isPluginInternal(meta)
    const repoUrl = meta.source?.repo ?? null
    const hasUrl = !internal && repoUrl

    const [repoName, setRepoName] = useState<string | null>(null)

    useEffect(() => {
        if (!hasUrl) return
        listRepos().then(
            repos => {
                const repo = repos.find(r => r.url === repoUrl)
                if (repo?.name) setRepoName(repo.name)
            },
            () => {},
        )
    }, [repoUrl, hasUrl])

    return hasUrl
        ? repoName
            ? `${repoName} (${repoUrl})`
            : repoUrl
        : internal
          ? 'Built-in'
          : 'Sideloaded'
}

function PluginActions({
    plugin,
    closeSheet,
}: {
    plugin: AnyPlugin
    closeSheet: () => void
}) {
    const [settingsRef, showEnableTooltip] = usePluginTooltip(
        PluginTooltip.Enable,
    )
    const meta = getInternalPluginMeta(plugin)
    const startable = isPluginStartable(plugin)
    const enabled = usePluginEnabled(plugin)
    // Any lifecycle progress counts as running, stop waits for in-flight lifecycles
    const running = Boolean(usePluginStatus(plugin))

    return (
        <Stack
            direction="horizontal"
            justify="space-around"
            style={{ paddingHorizontal: 8, paddingVertical: 16 }}
        >
            {enabled && !isPluginEssential(meta) && (
                <IconButton
                    variant="secondary"
                    size="lg"
                    icon={running ? StopIcon : PlayIcon}
                    label={running ? 'Stop' : 'Start'}
                    // Nothing can start in a defaults-only boot, stopping a default plugin is still fine
                    disabled={!running && (!startable || isDefaultsOnlyBoot)}
                    onPress={async () => {
                        try {
                            if (running) await stopPlugin(plugin)
                            else await runPluginLate(plugin)
                        } catch (e) {
                            showErrorToast(messageOf(e))
                        }
                    }}
                />
            )}
            <IconButton
                variant="secondary"
                size="lg"
                icon={FileWarningIcon}
                label="Clear Data"
                onPress={() => {
                    showPluginClearDataConfirmation(plugin, closeSheet)
                }}
            />
            {!isPluginInternal(meta) && (
                <IconButton
                    variant="destructive"
                    size="lg"
                    icon={TrashIcon}
                    label="Uninstall"
                    onPress={() => {
                        showPluginUninstallConfirmation(plugin, closeSheet)
                    }}
                />
            )}
            {plugin.SettingsComponent && (
                <Pressable
                    onPress={() => {
                        if (!startable) showEnableTooltip()
                    }}
                >
                    <IconButton
                        ref={settingsRef}
                        variant="secondary"
                        size="lg"
                        icon={SettingsIcon}
                        label="Settings"
                        disabled={!startable}
                        onPress={() => {
                            openPluginSettings(plugin)
                            closeSheet()
                        }}
                    />
                </Pressable>
            )}
        </Stack>
    )
}

const CopyIcon = lookupGeneratedIconComponent('CopyIcon')!

export function showCopiedToClipboardToast() {
    ToastActionCreators.open({
        key: 'REVENGE_PLUGIN_SETTINGS_COPIED',
        content: 'Copied to clipboard',
        IconComponent: CopyIcon,
    })
}
