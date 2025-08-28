import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { proxify } from '@revenge-mod/utils/proxy'
import type { NavigationContainerRef } from '@react-navigation/core'

const { loose, relative } = withDependencies

export interface RootNavigationRef {
    getRootNavigationRef<
        T extends object = Record<string, unknown>,
    >(): NavigationContainerRef<T>
}

// modules/main_tabs_v2/RootNavigationRef.native.tsx
export let RootNavigationRef: RootNavigationRef = proxify(
    () => {
        const [module] = lookupModule(
            withProps<RootNavigationRef>('getRootNavigationRef').and(
                withDependencies([
                    loose([[], loose([relative(1), relative(2)])]),
                    2,
                ]),
            ),
            {
                uninitialized: true,
            },
        )

        if (module) return (RootNavigationRef = module)
    },
    {
        hint: {},
    },
)!
