import type { PluginVersion } from '@revenge-mod/plugins/types'

/**
 * Formats a plugin version for display.
 */
export const formatVersion = (version: PluginVersion) =>
    version.nums.join('.') + (version.label ? `-${version.label}` : '')
