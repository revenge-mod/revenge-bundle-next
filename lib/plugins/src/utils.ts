import type { PluginManifest, PluginVersion } from '@revenge-mod/plugins/types'

/** Formats plugin version for display. */
export const formatVersion = (version: PluginVersion) =>
    version.nums.join('.') + (version.label ? `-${version.label}` : '')

/** Contributor parsed from a `Name <DISCORD_ID> (LINK "LABEL")` string. */
export interface PluginContributor {
    name: string
    /** Discord user IDs. */
    ids: string[]
    /** Links with `https:`, `http:` or `mailto:` scheme. */
    links: PluginContributorLink[]
}

/** Contributor link with an optional display label. */
export interface PluginContributorLink {
    url: string
    label?: string
}

const ContributorEntryRegex =
    /^(?:<(\d{17,20})>|\(((?:https?:\/\/|mailto:)[^()\s]+)(?:\s+"([^"()]+)")?\))\s*/i

/**
 * Parses a contributor string, such as {@link PluginManifest.author}.
 *
 * Format: `Name <DISCORD_ID_1> <DISCORD_ID_N> (LINK_1 "LABEL") (LINK_N)`.
 * Discord IDs and links are optional and repeatable, with IDs first.
 *
 * @returns The parsed contributor, or `null` when the string does not follow the format.
 */
export function parsePluginContributor(
    contributor: string,
): PluginContributor | null {
    const start = contributor.search(/[<(]/)
    const name = (
        start === -1 ? contributor : contributor.slice(0, start)
    ).trim()
    if (!name) return null

    const ids: string[] = []
    const links: PluginContributorLink[] = []

    if (start !== -1) {
        let rest = contributor.slice(start)

        while (rest) {
            const match = ContributorEntryRegex.exec(rest)
            if (!match) return null

            const [entry, id, url, label] = match
            if (id) {
                if (links.length) return null
                ids.push(id)
            } else links.push({ url: url!, label })

            rest = rest.slice(entry.length)
        }
    }

    return { name, ids, links }
}

/** Returns the contributor's name, or the raw string when unparseable. */
export const getPluginContributorName = (contributor: string) =>
    parsePluginContributor(contributor)?.name ?? contributor
