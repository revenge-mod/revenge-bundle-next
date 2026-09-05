import {
    AlertActionCreators,
    ToastActionCreators,
} from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { Clipboard } from '@revenge-mod/externals/react-native-clipboard'
import {
    isPluginSystemErrorPayload,
    pList,
    setUpdatesPaused,
} from '@revenge-mod/plugins/_'
import {
    installFromRepo,
    listRepoPlugins,
    listRepos,
    planInstall,
    setPluginHeld,
} from '@revenge-mod/plugins/_/repositories'
import { lookupGeneratedIconComponent } from '@revenge-mod/utils/discord'
import { PluginIcon } from '../components/PluginIcon'
import type {
    InstallPlan,
    RepoPluginListing,
} from '@revenge-mod/plugins/_/repositories'

const { AlertActionButton, AlertModal } = Design

const CircleXIconComponent = lookupGeneratedIconComponent(
    'CircleXIcon',
    'CircleXIcon-primary',
    'CircleXIcon-secondary',
)!

export function showErrorToast(message: string) {
    ToastActionCreators.open({
        key: 'REVENGE_REPOSITORIES_ERROR',
        content: message,
        IconComponent: CircleXIconComponent,
    })
}

export function messageOf(e: unknown) {
    if (e instanceof Error) return e.message
    if (isPluginSystemErrorPayload(e)) return e.message
    return String(e)
}

export function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const PlanConfirmAlertKey = 'repo-install-plan-confirm'

/**
 * Shows the resolved plan and asks before anything downloads.
 * Resolves true only when the user presses Install.
 */
export async function confirmPlan(
    plan: InstallPlan,
    /** Extra line shown under the summary, for anything the plan itself doesn't say. */
    note?: string,
): Promise<boolean> {
    const repos = await listRepos()

    let resolve!: (value: boolean) => void
    const promise = new Promise<boolean>(r => (resolve = r))
    const listingCache = new Map<string, RepoPluginListing[]>()

    const summary = await Promise.all(
        plan.actions.map(async action => {
            const row = (
                label: string,
                repo: string,
                author?: string,
                icon?: string | null,
            ) => (
                <Design.TableRow
                    icon={<PluginIcon icon={icon ?? undefined} size={24} />}
                    onPress={() => {
                        Clipboard.setString(
                            `${label} (${action.id}) v${action.version} (${action.channel})${author ? ` by ${author}` : ''} from ${repo} (${action.repo})\n\n` +
                                `Replaces: ${action.replaces ?? '(None)'}\n` +
                                `Download: ${action.url} (size: ${action.size})\n` +
                                `SHA256: ${action.sha256}`,
                        )
                    }}
                    label={
                        action.replaces
                            ? `${label} • ${action.replaces} → ${action.version}`
                            : `${label} • ${action.version}`
                    }
                    subLabel={`${author ? `${author} • ` : ''}${repo} • ${formatBytes(action.size)}`}
                />
            )

            const repo = repos.find(r => r.url === action.repo)
            if (!repo) return row(action.id, action.repo)

            const plugins =
                listingCache.get(repo.url) ?? (await listRepoPlugins(repo.url))

            const plugin = plugins.find(p => p.id === action.id)
            if (!plugin) return row(action.id, repo.name || action.repo)

            return row(
                plugin.name || action.id,
                repo.name || action.repo,
                plugin.author,
                plugin.icon,
            )
        }),
    )

    AlertActionCreators.openAlert(
        PlanConfirmAlertKey,
        <AlertModal
            title={
                plan.actions.length === 1
                    ? 'Install plugin?'
                    : `Install ${plan.actions.length} plugins?`
            }
            content={
                [
                    plan.actions.length > 1
                        ? 'Some plugins require other plugins to be installed first. The following will be installed:'
                        : undefined,
                    note,
                ]
                    .filter(Boolean)
                    .join('\n\n') || undefined
            }
            extraContent={
                <Design.TableRowGroup>{summary}</Design.TableRowGroup>
            }
            actions={
                <>
                    <AlertActionButton
                        text="Install"
                        variant="primary"
                        onPress={() => resolve(true)}
                    />
                    <AlertActionButton
                        text="Cancel"
                        variant="secondary"
                        onPress={() => resolve(false)}
                    />
                </>
            }
        />,
    )

    return await promise
}

/**
 * Runs the install flow for one plugin: resolve, show warnings, confirm the plan, and execute.
 * Errors show as toasts.
 *
 * Pass `version`, `channel`, and `filteredRepos` to pin what the user was shown, so the plan
 * matches the card instead of resolving to whatever a higher-priority repo serves.
 *
 * Resolves true only when the plan was confirmed and installed.
 */
export async function runInstallFlow(
    id: string,
    version?: string,
    channel?: string,
    filteredRepos?: string[],
    /**
     * Pause updates once it's installed. Only for a version the user actually picked, see
     * {@link installExactVersion}.
     */
    hold = false,
): Promise<boolean> {
    try {
        const plan = await planInstall(id, version, channel, filteredRepos)
        if (plan.warnings.length) showErrorToast(plan.warnings.join('\n'))

        const accepted = await confirmPlan(
            plan,
            hold
                ? `Updates will be paused so it stays on ${version}. Turn "Pause updates" off to follow updates again.`
                : undefined,
        )
        AlertActionCreators.dismissAlert(PlanConfirmAlertKey)
        if (!accepted) return false

        await installFromRepo(plan)
        if (hold) await pauseUpdates(id, version!)

        return true
    } catch (e) {
        showErrorToast(messageOf(e))
        return false
    }
}

/**
 * Installs one specific version and holds it there.
 *
 * Resolves true only when the plan was confirmed and installed.
 */
export function installExactVersion(
    id: string,
    version: string,
    channel?: string,
    filteredRepos?: string[],
): Promise<boolean> {
    return runInstallFlow(id, version, channel, filteredRepos, true)
}

/** Holds a plugin at its installed version. */
async function pauseUpdates(id: string, version: string) {
    try {
        const plugin = pList.get(id)
        if (plugin) await setUpdatesPaused(plugin, true)
        else await setPluginHeld(id, true)
    } catch (e) {
        showErrorToast(
            `Installed ${version}, but updates could not be paused: ${messageOf(e)}`,
        )
    }
}
