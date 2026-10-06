import { SheetHeader } from '@revenge-mod/components'
import { ActionSheetActionCreators } from '@revenge-mod/discord/actions'
import { Design } from '@revenge-mod/discord/design'
import { ReactNativeSafeAreaContext } from '@revenge-mod/externals/react-native-safe-area-context'
import { listRepos } from '@revenge-mod/plugins/_/repositories'
import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { findRepoListing, messageOf, showErrorToast } from '../utils/repos'
import { RepositoryRadioGroup } from './PluginSourceRadioGroups'
import RefreshButton from './RefreshButton'
import type { RepoOffer } from '../utils/repos'

const { BottomSheet, TableRowGroup, TableRow, createStyles } = Design

export interface PluginRepositoryPickerActionSheetProps {
    id: string
    name: string
    /** Selected repository URL. */
    repo: string | null
    /** Resolves `true` to select the picked repository. */
    onSelect: (offer: RepoOffer) => Promise<boolean> | boolean
}

export default function PluginRepositoryPickerActionSheet({
    id,
    name,
    repo,
    onSelect,
}: PluginRepositoryPickerActionSheetProps) {
    const [selected, setSelected] = useState(repo)
    const [offers, setOffers] = useState<RepoOffer[] | null>(null)
    const [loading, setLoading] = useState(false)
    const busy = useRef(false)
    const styles_ = useStyles()
    const { bottom } = ReactNativeSafeAreaContext.useSafeAreaInsets()

    const load = useCallback(
        async (refresh: boolean) => {
            setLoading(true)
            try {
                const repos = (await listRepos()).filter(
                    r => r.enabled && !r.internal,
                )
                const errors: string[] = []

                const listings = await Promise.all(
                    repos.map(repo =>
                        findRepoListing(repo.url, id, refresh).catch(e => {
                            errors.push(
                                `${repo.name ?? repo.url}: ${messageOf(e)}`,
                            )
                        }),
                    ),
                )

                // Errors only matter on a manual refresh
                if (refresh && errors.length) showErrorToast(errors.join('\n'))

                // Names can change after a refresh
                const names = new Map(
                    (await listRepos()).map(r => [r.url, r.name]),
                )

                setOffers(
                    repos.flatMap((repo, i) => {
                        const listing = listings[i]
                        return listing
                            ? [
                                  {
                                      url: repo.url,
                                      name: names.get(repo.url) ?? repo.name,
                                      listing,
                                  },
                              ]
                            : []
                    }),
                )
            } catch (e) {
                showErrorToast(messageOf(e))
            } finally {
                setLoading(false)
            }
        },
        [id],
    )

    useEffect(() => {
        load(false)
    }, [load])

    return (
        <BottomSheet
            header={
                <SheetHeader
                    title="Select repository"
                    action={
                        <RefreshButton
                            loading={loading}
                            onPress={() => load(true)}
                        />
                    }
                />
            }
        >
            <View style={[styles_.body, { paddingBottom: 16 + bottom }]}>
                {offers?.length ? (
                    <RepositoryRadioGroup
                        title={`Repositories serving ${name}`}
                        repos={offers}
                        value={selected}
                        onChange={url => {
                            const offer = offers.find(o => o.url === url)
                            if (busy.current || !offer) return

                            busy.current = true
                            Promise.resolve(onSelect(offer))
                                .then(picked => {
                                    if (picked) setSelected(offer.url)
                                })
                                .finally(() => {
                                    busy.current = false
                                })
                        }}
                    />
                ) : (
                    offers && (
                        <TableRowGroup>
                            <TableRow
                                label="No repositories serve this plugin"
                                subLabel="Add a repository that serves it, or refresh to check again."
                            />
                        </TableRowGroup>
                    )
                )}
            </View>
        </BottomSheet>
    )
}

const useStyles = createStyles({
    body: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
})

export function openPluginRepositoryPickerActionSheet(
    props: PluginRepositoryPickerActionSheetProps,
) {
    ActionSheetActionCreators.openLazy(
        Promise.resolve({ default: PluginRepositoryPickerActionSheet }),
        'REVENGE_PLUGIN_REPOSITORY_PICKER',
        props,
        'stack',
    )
}
