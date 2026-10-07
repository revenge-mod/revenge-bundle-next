import { Design } from '@revenge-mod/discord/design'
import { formatBytes } from '../utils/strings'
import type {
    RepoPluginListing,
    VersionCandidate,
} from '@revenge-mod/plugins/_/repositories'

const { TableRadioGroup, TableRadioRow } = Design

/** Limits pickable versions, eg. to a plan's dependent ranges. */
export interface VersionConstraints {
    candidates: Record<string, VersionCandidate>
    /** Subtitle for unpickable versions, eg. `Needs >=1.0 <2 for Plugin`. */
    reason: string
    nameOf: (id: string) => string
}

/** Returns why a version is unpickable, what it breaks, or `fallback`. */
function describeVersion(
    version: string,
    fallback: string,
    constraints?: VersionConstraints,
) {
    if (!constraints) return fallback

    const broken = constraints.candidates[version]?.breaks
    if (!broken) return constraints.reason
    if (broken.length)
        return `Breaks ${broken.map(constraints.nameOf).join(', ')}`
    return fallback
}

const isUnavailable = (version: string, constraints?: VersionConstraints) =>
    Boolean(constraints && !(version in constraints.candidates))

export function RepositoryRadioGroup({
    title = 'Repository',
    repos,
    value,
    onChange,
    disabled,
}: {
    title?: string
    repos: {
        url: string
        name: string | null
        /** Disables the row, shown as its subtitle. */
        unavailable?: string
    }[]
    value: string | null
    /** Called only when a different repository is picked. */
    onChange: (url: string) => void
    disabled?: boolean
}) {
    return (
        <TableRadioGroup
            title={title}
            value={value}
            onChange={(url: string | null) => {
                if (url && url !== value) onChange(url)
            }}
        >
            {repos.map(repo => (
                <TableRadioRow
                    key={repo.url}
                    label={repo.name ?? repo.url}
                    subLabel={
                        repo.unavailable ?? (repo.name ? repo.url : undefined)
                    }
                    value={repo.url}
                    disabled={disabled || Boolean(repo.unavailable)}
                />
            ))}
        </TableRadioGroup>
    )
}

export function ChannelRadioGroup({
    listing,
    value,
    onChange,
    disabled,
    constraints,
}: {
    listing: RepoPluginListing
    /** Followed channel, `null` when following a version. */
    value: string | null
    /** Called only when a different channel is picked. */
    onChange: (channel: string) => void
    disabled?: boolean
    constraints?: VersionConstraints
}) {
    return (
        <TableRadioGroup
            title="Follow a channel"
            description="Updates install automatically as the channel moves."
            value={value}
            onChange={(channel: string | null) => {
                if (channel && channel !== value) onChange(channel)
            }}
        >
            {Object.entries(listing.channels).map(([channel, version]) => (
                <TableRadioRow
                    key={channel}
                    label={channel}
                    subLabel={describeVersion(
                        version,
                        `v${version}`,
                        constraints,
                    )}
                    value={channel}
                    disabled={disabled || isUnavailable(version, constraints)}
                />
            ))}
        </TableRadioGroup>
    )
}

export function VersionRadioGroup({
    listing,
    value,
    onChange,
    disabled,
    constraints,
}: {
    listing: RepoPluginListing
    /** Held version, `null` when following a channel. */
    value: string | null
    /** Called only when a different version is picked. */
    onChange: (version: string) => void
    disabled?: boolean
    constraints?: VersionConstraints
}) {
    return (
        <TableRadioGroup
            title="Stay on a version"
            description="Pauses updates for this plugin."
            value={value}
            onChange={(version: string | null) => {
                if (version && version !== value) onChange(version)
            }}
        >
            {listing.order.map(version => (
                <TableRadioRow
                    key={version}
                    label={`v${version}`}
                    subLabel={describeVersion(
                        version,
                        formatVersionDetails(listing, version),
                        constraints,
                    )}
                    value={version}
                    disabled={disabled || isUnavailable(version, constraints)}
                />
            ))}
        </TableRadioGroup>
    )
}

/** Channels pointing at the version, and its download size. */
function formatVersionDetails(listing: RepoPluginListing, version: string) {
    const channels = Object.entries(listing.channels)
        .filter(([, target]) => target === version)
        .map(([channel]) => channel)

    return [...channels, formatBytes(listing.versions[version]!.size)].join(
        ' \u2022 ',
    )
}
