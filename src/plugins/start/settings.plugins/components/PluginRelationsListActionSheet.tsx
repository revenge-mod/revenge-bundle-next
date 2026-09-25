import { Design } from '@revenge-mod/discord/design'
import { Clipboard } from '@revenge-mod/externals/react-native-clipboard'
import { formatVersion } from '@revenge-mod/plugins/utils'
import { PluginIcon } from './PluginIcon'
import type { DiscordModules } from '@revenge-mod/discord/types'
import type { AnyPlugin } from '@revenge-mod/plugins/_'
import type {
    PluginDependencyConstraint,
    PluginManifest,
} from '@revenge-mod/plugins/types'

const { ActionSheet, Stack, TableRow, TableRowGroup } = Design

export interface PluginRelationsListActionSheetProps {
    title: string
    unsatisfiedTitle?: string
    dependencyMap?: NonNullable<PluginManifest['dependencies']>
    plugins: AnyPlugin[]
    unsatisfiedPlugins?: Array<string | AnyPlugin>
}

interface PluginRowProps {
    plugin: AnyPlugin
    variant?: DiscordModules.Components.TableRowProps['variant']
    dependency?: PluginDependencyConstraint
    showInstalledVersion?: boolean
}

const formatDependencyRequirement = (dependency: PluginDependencyConstraint) =>
    `(${dependency.version ?? '*'} ${dependency.optional ? 'optional' : 'required'})`

function PluginRow({
    plugin,
    dependency,
    variant,
    showInstalledVersion = false,
}: PluginRowProps) {
    const { id, name, version, icon } = plugin.manifest
    const installedVersion = showInstalledVersion
        ? `@${formatVersion(version)}`
        : ''
    const depRequirement = dependency
        ? ` ${formatDependencyRequirement(dependency)}`
        : ''

    const subLabel = `${id}${installedVersion}${depRequirement}`

    return (
        <TableRow
            icon={
                <PluginIcon
                    danger={variant === 'danger'}
                    icon={icon ?? undefined}
                    size={24}
                />
            }
            label={name}
            subLabel={subLabel}
            variant={variant}
            onPress={() => Clipboard.setString(subLabel)}
        />
    )
}

export default function PluginRelationsListActionSheet({
    title,
    unsatisfiedTitle,
    dependencyMap,
    plugins,
    unsatisfiedPlugins,
}: PluginRelationsListActionSheetProps) {
    return (
        <ActionSheet>
            <Stack spacing={24} style={{ paddingTop: 8 }}>
                <TableRowGroup title={title}>
                    {plugins.map(plugin => (
                        <PluginRow
                            key={plugin.manifest.id}
                            plugin={plugin}
                            // biome-ignore lint/suspicious/noNonNullAssertedOptionalChain: Can't be undefined
                            dependency={dependencyMap?.[plugin.manifest.id]!}
                            showInstalledVersion
                        />
                    ))}
                </TableRowGroup>

                {Boolean(unsatisfiedPlugins?.length) && (
                    <TableRowGroup title={unsatisfiedTitle}>
                        {unsatisfiedPlugins?.map(plugin => {
                            if (typeof plugin === 'string') {
                                // biome-ignore lint/suspicious/noNonNullAssertedOptionalChain: Can't be undefined
                                const dep = dependencyMap?.[plugin]!

                                return (
                                    <TableRow
                                        key={plugin}
                                        icon={
                                            <PluginIcon
                                                icon="CircleQuestionIcon"
                                                danger
                                                size={24}
                                            />
                                        }
                                        label={plugin}
                                        subLabel={`${plugin} (not installed) ${formatDependencyRequirement(dep)}`}
                                        variant="danger"
                                        onPress={() =>
                                            Clipboard.setString(plugin)
                                        }
                                    />
                                )
                            }

                            return (
                                <PluginRow
                                    key={plugin.manifest.id}
                                    plugin={plugin}
                                    variant="danger"
                                    dependency={
                                        // biome-ignore lint/suspicious/noNonNullAssertedOptionalChain: Can't be undefined
                                        dependencyMap?.[plugin.manifest.id]!
                                    }
                                />
                            )
                        })}
                    </TableRowGroup>
                )}
            </Stack>
        </ActionSheet>
    )
}
