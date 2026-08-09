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
    runPluginLate,
    stopPlugin,
} from '@revenge-mod/plugins/_'
import { listRepos } from '@revenge-mod/plugins/_/repositories'
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
import { messageOf, showErrorToast } from '../utils/repos'
import { InstalledPluginSwitch, PluginInfo } from './PluginCard'
import { usePluginEnabled, usePluginStatus } from './PluginStateProvider'
import {
    EnablePluginTooltipProvider,
    useClickOutsideTooltip,
    useEnablePluginTooltip,
} from './TooltipProvider'
import type { AnyPlugin } from '@revenge-mod/plugins/_'

export interface PluginOptionsActionSheetProps {
    plugin: AnyPlugin
    sheetKey: string
}

const { ActionSheet, IconButton, TableRowGroup, TableRow, Stack } = Design

const FileWarningIcon = getAssetIdByName('FileWarningIcon', 'png')!
const PlayIcon = getAssetIdByName('PlayIcon', 'png')!
const SettingsIcon = getAssetIdByName('SettingsIcon', 'png')!
const StopIcon = getAssetIdByName('StopIcon', 'png')!
const TrashIcon = getAssetIdByName('TrashIcon', 'png')!

export default function PluginOptionsActionSheet({
    plugin,
    sheetKey,
}: PluginOptionsActionSheetProps) {
    const enabled = usePluginEnabled(plugin)
    const meta = getInternalPluginMeta(plugin)
    const essential = isPluginEssential(meta)
    const pendingUpdate = isPluginPendingUpdate(plugin)
    const { name, author, description, icon, version } = plugin.manifest

    return (
        <ActionSheet>
            <Stack spacing={24} style={{ paddingTop: 8 }}>
                <PluginInfo
                    name={name}
                    author={author}
                    version={formatVersion(version)}
                    description={description}
                    icon={icon}
                    actions={
                        !essential && (
                            <InstalledPluginSwitch
                                enabled={enabled}
                                plugin={plugin}
                                savedEnabled={isPluginEnabledInSavedStates(
                                    plugin,
                                )}
                                toggleDisabled={pendingUpdate}
                            />
                        )
                    }
                />
                <ClickOutsideProvider>
                    <EnablePluginTooltipProvider>
                        <PluginActions
                            plugin={plugin}
                            closeSheet={() => {
                                ActionSheetActionCreators.hideActionSheet(
                                    sheetKey,
                                )
                            }}
                        />
                    </EnablePluginTooltipProvider>
                </ClickOutsideProvider>
                <StatusSection plugin={plugin} />
                <AdvancedSection plugin={plugin} />
            </Stack>
        </ActionSheet>
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

function AdvancedSection({ plugin }: { plugin: AnyPlugin }) {
    const meta = getInternalPluginMeta(plugin)
    const dependents = getPluginDependents(plugin, true)
    const dependencies = getPluginDependencies(plugin, false)
    const repositoryText = usePluginRepositoryText(plugin)
    const { id, name } = plugin.manifest

    return (
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
                                plugins: dependencies,
                            },
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
                        )
                    }}
                />
            )}
        </TableRowGroup>
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
    const enableTooltip = useEnablePluginTooltip()
    const settingsRef = useClickOutsideTooltip(useEnablePluginTooltip, () => {})
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
