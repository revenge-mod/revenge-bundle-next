import {
    AlertActionCreators,
    ToastActionCreators,
} from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { Clipboard } from '@revenge-mod/externals/react-native-clipboard'
import { isPluginError } from '@revenge-mod/plugins/_'
import {
    installFromRepo,
    listRepoPlugins,
    listRepos,
    planInstall,
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
    if (isPluginError(e)) return e.message
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
export async function confirmPlan(plan: InstallPlan): Promise<boolean> {
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
                plan.actions.length > 1
                    ? 'Some plugins require other plugins to be installed first. The following will be installed:'
                    : undefined
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
): Promise<boolean> {
    try {
        const plan = await planInstall(id, version, channel, filteredRepos)
        if (plan.warnings.length) showErrorToast(plan.warnings.join('\n'))

        const accepted = await confirmPlan(plan)
        AlertActionCreators.dismissAlert(PlanConfirmAlertKey)
        if (!accepted) return false

        await installFromRepo(plan)
        return true
    } catch (e) {
        showErrorToast(messageOf(e))
        return false
    }
}

/**
 * Same as {@link runInstallFlow}, but automatically includes every internal repository plus
 * the target repository in `filteredRepos`, so repo-installed plugins can be updated in place.
 */
export async function runInstallFlowWithInternalRepos(
    id: string,
    version?: string,
    channel?: string,
    repo?: string,
): Promise<boolean> {
    const repos = await listRepos()
    const filteredRepos = repos
        .filter(r => r.internal)
        .map(r => r.url)
    if (repo) filteredRepos.push(repo)
    return runInstallFlow(id, version, channel, filteredRepos)
}
