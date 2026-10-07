import { getAssetIdByName } from '@revenge-mod/assets'
import { TableRowAssetIcon } from '@revenge-mod/components'
import {
    ActionSheetActionCreators,
    ToastActionCreators,
} from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { Clipboard } from '@revenge-mod/externals/react-native-clipboard'
import {
    formatPluginSystemErrorPayload,
    getInternalPluginMeta,
    getPluginDependencies,
    getPluginDependents,
    getUnsatisfiedPluginDependencies,
    hasPluginStub,
    InternalPluginFlags,
    isDefaultsOnlyBoot,
    isPluginEssential,
    isPluginInternal,
    isPluginPendingUpdate,
    isPluginStartable,
    isPluginStarted,
    PluginFlags,
    PluginStatus,
    pList,
    runPluginLate,
    setUpdatesPaused,
    stopPlugin,
} from '@revenge-mod/plugins/_'
import {
    usePluginEnabled,
    usePluginEnabledInActiveSlot,
    usePluginFlags,
    usePluginSource,
    usePluginStatus,
} from '@revenge-mod/plugins/_/react'
import { formatVersion } from '@revenge-mod/plugins/utils'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { Pressable } from 'react-native'
import { ClickOutsideProvider } from 'react-native-click-outside'
import {
    openPluginSettings,
    showErrorToast,
    showPluginClearDataConfirmation,
    showPluginUninstallConfirmation,
} from '../utils/alerts'
import {
    installPluginRef,
    pluginRefOf,
    retargetPluginRef,
} from '../utils/repos'
import { messageOf, useRepositoryText, versionTextOf } from '../utils/strings'
import {
    InstalledPluginSwitch,
    PluginAuthor,
    PluginInfo,
    PluginInfoStatusIcon,
} from './PluginCard'
import { openPluginRefPickerActionSheet } from './PluginRefPickerActionSheet'
import { openPluginRepositoryPickerActionSheet } from './PluginRepositoryPickerActionSheet'
import { RefPickerRow, RepositoryPickerRow } from './PluginSourceRows'
import PluginTooltipsProvider, {
    PluginTooltip,
    usePluginTooltip,
} from './TooltipProvider'
import type { AnyPlugin, InternalPluginMeta } from '@revenge-mod/plugins/_'

export interface PluginOptionsActionSheetProps {
    plugin: AnyPlugin
    sheetKey: string
}

const {
    ActionSheet,
    IconButton,
    TableRowGroup,
    TableRow,
    TableSwitchRow,
    Text,
    Stack,
} = Design

const FileWarningIcon = getAssetIdByName('FileWarningIcon', 'png')!
const PlayIcon = getAssetIdByName('PlayIcon', 'png')!
const SettingsIcon = getAssetIdByName('SettingsIcon', 'png')!
const HandRequestSpeakIcon = getAssetIdByName('HandRequestSpeakIcon', 'png')!
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
    const savedEnabled = usePluginEnabledInActiveSlot(plugin)
    const meta = getInternalPluginMeta(plugin)
    const essential = isPluginEssential(meta)
    const pendingUpdate = isPluginPendingUpdate(plugin)
    const { name, author, contributors, description, icon, version } =
        plugin.manifest

    const [switchRef, showPendingUpdateTooltip] = usePluginTooltip(
        PluginTooltip.PendingUpdate,
    )

    return (
        <Stack spacing={24} style={{ paddingTop: 8 }}>
            <PluginInfo
                info={{
                    name,
                    description,
                    icon,
                    version: formatVersion(version),
                }}
                author={
                    <PluginAuthor
                        pluginName={name}
                        author={author}
                        contributors={contributors}
                    />
                }
                extraInfo={<PluginInfoStatusIcon plugin={plugin} />}
                actions={
                    !essential && (
                        <Pressable
                            onPress={() => {
                                if (pendingUpdate) showPendingUpdateTooltip()
                            }}
                            ref={switchRef}
                        >
                            <InstalledPluginSwitch
                                plugin={plugin}
                                enabled={savedEnabled}
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
            <ErrorsSection plugin={plugin} meta={meta} />
            <UpdatesSection plugin={plugin} meta={meta} />
            <AdvancedSection plugin={plugin} meta={meta} />
        </Stack>
    )
}

function ErrorsSection({
    plugin,
    meta,
}: {
    plugin: AnyPlugin
    meta: InternalPluginMeta
}) {
    const errors = [...plugin.errors, ...meta.nativeErrors]

    return (
        errors.length > 0 && (
            <TableRowGroup hasIcons>
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
                            errors
                                .map(formatPluginSystemErrorPayload)
                                .join('\n\n'),
                        )
                        showCopiedToClipboardToast()
                    }}
                />
            </TableRowGroup>
        )
    )
}

function AdvancedSection({
    plugin,
    meta,
}: {
    plugin: AnyPlugin
    meta: InternalPluginMeta
}) {
    const flags = usePluginFlags(plugin)
    const status = usePluginStatus(plugin)
    const dependents = getPluginDependents(plugin, true)
    const dependencies = getPluginDependencies(plugin, false)
    const { id, name } = plugin.manifest

    return (
        <TableRowGroup hasIcons title="Advanced">
            <IdRow id={id} />
            <TableRow
                icon={<TableRowAssetIcon name="CircleInformationIcon" />}
                label="Status"
                subLabel={bitFieldToString(PluginStatus, status)}
            />
            <TableRow
                icon={<TableRowAssetIcon name="FlagIcon" />}
                label="Flags"
                subLabel={bitFieldToString(PluginFlags, flags)}
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
                                    getUnsatisfiedPluginDependencies(
                                        plugin,
                                    ).map(id => pList.get(id) ?? id),
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
    )
}

function UpdatesSection({
    plugin,
    meta,
}: {
    plugin: AnyPlugin
    meta: InternalPluginMeta
}) {
    const source = usePluginSource(plugin)
    // Built-in without stub updates
    const builtIn = isPluginInternal(meta) && !source
    const repo = source?.repo ?? null
    const { id, name } = plugin.manifest

    // Re-render on updates
    usePluginFlags(plugin)

    return (
        <TableRowGroup title="Updates">
            {!isPluginInternal(meta) && (
                <AllowUpdatesRow plugin={plugin} held={source?.held ?? false} />
            )}
            <RepositoryPickerRow
                text={useRepositoryText(repo, builtIn)}
                onPress={
                    builtIn
                        ? undefined
                        : () =>
                              openPluginRepositoryPickerActionSheet({
                                  id,
                                  name,
                                  repo,
                                  onSelect: offer =>
                                      installPluginRef(
                                          id,
                                          offer.url,
                                          retargetPluginRef(
                                              pluginRefOf(plugin),
                                              offer.listing,
                                          ),
                                      ),
                              })
                }
            />
            <RefPickerRow
                pluginRef={repo ? pluginRefOf(plugin) : undefined}
                version={versionTextOf(plugin)}
                onPress={
                    repo
                        ? () =>
                              openPluginRefPickerActionSheet({
                                  id,
                                  repo,
                                  pluginRef: pluginRefOf(plugin),
                                  onSelect: ref =>
                                      installPluginRef(id, repo, ref),
                              })
                        : undefined
                }
            />
        </TableRowGroup>
    )
}

function AllowUpdatesRow({
    plugin,
    held,
}: {
    plugin: AnyPlugin
    held: boolean
}) {
    const allowUpdates = !held

    return (
        <TableSwitchRow
            icon={
                <TableRowAssetIcon
                    IconComponent={lookupGeneratedIconComponent('RefreshIcon')!}
                />
            }
            label="Allow updates"
            subLabel={
                allowUpdates ? undefined : (
                    <Text
                        color="text-feedback-critical"
                        variant="text-xs/medium"
                    >
                        Other plugins won't be able to update if they need a
                        newer version of {plugin.manifest.name}
                    </Text>
                )
            }
            value={allowUpdates}
            onValueChange={value => {
                setUpdatesPaused(plugin, !value).catch(e =>
                    showErrorToast(messageOf(e)),
                )
            }}
        />
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

function PluginActions({
    plugin,
    closeSheet,
}: {
    plugin: AnyPlugin
    closeSheet: () => void
}) {
    const [controlRef, showControlBlockedTooltip] = usePluginTooltip(
        PluginTooltip.ControlBlocked,
    )
    const [settingsRef, showStartTooltip] = usePluginTooltip(
        PluginTooltip.Start,
    )

    const meta = getInternalPluginMeta(plugin)
    const startable = isPluginStartable(plugin)
    const started = isPluginStarted(plugin)
    const enabled = usePluginEnabled(plugin)
    // Any lifecycle progress counts as running, stop waits for in-flight lifecycles
    const running = Boolean(usePluginStatus(plugin))
    const notActionable = !running && (!startable || isDefaultsOnlyBoot)

    return (
        <Stack
            direction="horizontal"
            justify="space-around"
            style={{ paddingHorizontal: 8, paddingVertical: 16 }}
        >
            {plugin.SettingsComponent && (
                <Pressable
                    onPress={() => {
                        if (!started) showStartTooltip()
                    }}
                >
                    <IconButton
                        ref={settingsRef}
                        variant="secondary"
                        size="lg"
                        icon={SettingsIcon}
                        label="Settings"
                        disabled={!started}
                        onPress={() => {
                            openPluginSettings(plugin)
                            closeSheet()
                        }}
                    />
                </Pressable>
            )}
            {enabled && !isPluginEssential(meta) && (
                <Pressable
                    onPress={() => {
                        if (notActionable) showControlBlockedTooltip()
                    }}
                >
                    <IconButton
                        ref={controlRef}
                        variant="secondary"
                        size="lg"
                        icon={running ? HandRequestSpeakIcon : PlayIcon}
                        label={running ? 'Stop' : 'Start'}
                        // Nothing can start in a defaults-only boot, stopping a default plugin is still fine
                        disabled={notActionable}
                        onPress={async () => {
                            try {
                                if (running) await stopPlugin(plugin)
                                else await runPluginLate(plugin)
                            } catch (e) {
                                showErrorToast(messageOf(e))
                            }
                        }}
                    />
                </Pressable>
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
                    label={
                        hasPluginStub(meta) ? 'Uninstall updates' : 'Uninstall'
                    }
                    onPress={() => {
                        showPluginUninstallConfirmation(plugin, closeSheet)
                    }}
                />
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
