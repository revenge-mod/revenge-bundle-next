import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { proxify } from '@revenge-mod/utils/proxy'
import { ImportTrackerModuleId } from '../common/import-tracker'
import type { NavigationContainerRef } from '@react-navigation/core'

const { partial, relative } = withDependencies

export interface RootNavigationRef {
    getRootNavigationRef<
        T extends object = Record<string, unknown>,
    >(): NavigationContainerRef<T>
}

// modules/main_tabs_v2/RootNavigationRef.native.tsx
export let RootNavigationRef: RootNavigationRef = proxify(
    () => {
        const [module] = lookupModule(
            withProps<RootNavigationRef>('getRootNavigationRef')
                .and(
                    withDependencies([
                        partial([
                            relative.withDependencies([], 1),
                            relative.withDependencies(
                                partial([relative(1), relative(2)]),
                                2,
                            ),
                        ]),
                        // TODO: Decouple?
                        ImportTrackerModuleId,
                    ]),
                )
                .keyAs('revenge.discord.modules.mainTabsV2.RootNavigationRef'),
        )

        if (module) return (RootNavigationRef = module)
    },
    {
        hint: {},
    },
)!
