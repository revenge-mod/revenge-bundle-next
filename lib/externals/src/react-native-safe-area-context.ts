import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import {
    ReactJSXRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'
import type { ComparableDependencyMap } from '@revenge-mod/modules/finders/filters'

const { relative, loose } = withDependencies

const withSafeAreaContextModule = (
    /* first dependency's dependencies */
    firstDependencyDependencies: ComparableDependencyMap,
) =>
    withDependencies(
        // first dependency is next to this module, but we also need to check its dependencies
        // hence relative.withDependencies(firstDependencyDependencies, 1),
        loose([relative.withDependencies(firstDependencyDependencies, 1)]),
    )

export let ReactNativeSafeAreaContext: typeof import('react-native-safe-area-context') =
    proxify(
        () => {
            // TODO: Slice 1 and use once stable >341202, first dependency is dropped in modern
            const oldDeps = [
                null,
                null,
                ReactModuleId,
                ReactNativeModuleId,
                ReactJSXRuntimeModuleId,
                relative.withDependencies([relative(1)], 1),
            ]

            const [module] = lookupModule(
                withProps<typeof ReactNativeSafeAreaContext>('SafeAreaProvider')
                    .and(
                        withSafeAreaContextModule(oldDeps.slice(1)).or(
                            withSafeAreaContextModule(oldDeps),
                        ),
                    )
                    .keyAs(
                        'revenge.externals.ReactNativeSafeAreaContext.ReactNativeSafeAreaContext',
                    ),
            )

            if (module) {
                return (ReactNativeSafeAreaContext = module)
            }
        },
        {
            hint: {},
        },
    )!
