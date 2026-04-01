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

const { relative, loose } = withDependencies

export let ReactNativeSafeAreaContext: typeof import('react-native-safe-area-context') =
    proxify(
        () => {
            const [module] = lookupModule(
                withProps<typeof ReactNativeSafeAreaContext>(
                    'SafeAreaProvider',
                ).and(
                    withDependencies(
                        loose([
                            relative.withDependencies(
                                [
                                    null,
                                    null,
                                    ReactModuleId,
                                    ReactNativeModuleId,
                                    ReactJSXRuntimeModuleId,
                                    relative.withDependencies([relative(1)], 1),
                                ],
                                1,
                            ),
                        ]),
                    ),
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
