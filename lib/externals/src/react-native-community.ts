import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { ReactModuleId, ReactNativeModuleId } from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'

const { ordered, relative } = withDependencies

export let NetInfo: typeof import('@react-native-community/netinfo') = proxify(
    () => {
        const [module] = lookupModule(
            withProps<typeof NetInfo>('useNetInfo').and(
                withDependencies(
                    ordered([
                        ReactModuleId,
                        ReactNativeModuleId,
                        relative(1),
                        relative(2),
                        [],
                    ]),
                ),
            ),
        )

        if (module) return (NetInfo = module)
    },
    {
        hint: {},
    },
)!
