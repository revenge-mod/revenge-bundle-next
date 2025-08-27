import { lookupModule } from '@revenge-mod/modules/finders'
import {
    preferExports,
    withDependencies,
    withName,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { ReactJSXRuntimeModuleId, ReactModuleId } from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'

const { loose, relative } = withDependencies

const [, _createClassModuleId] = lookupModule(withName('_createClass'))
const [, _classCallCheckModuleId] = lookupModule(withName('_classCallCheck'))

export let ReactNavigationNative: typeof import('@react-navigation/native') =
    proxify(
        () => {
            const [module] = lookupModule(
                preferExports(
                    withProps<typeof ReactNavigationNative>('useLinkTo'),
                    withDependencies(
                        loose([
                            [],
                            loose([
                                [_createClassModuleId, _classCallCheckModuleId],
                            ]),
                        ]),
                    ),
                ),
                {
                    uninitialized: true,
                },
            )

            if (module) return (ReactNavigationNative = module)
        },
        {
            hint: {},
        },
    )!

export let ReactNavigationStack: typeof import('@react-navigation/stack') =
    proxify(
        () => {
            const [module] = lookupModule(
                preferExports(
                    withProps<typeof ReactNavigationStack>('StackView'),
                    withDependencies(
                        loose([
                            relative.withDependencies(
                                loose([
                                    [[]],
                                    ReactModuleId,
                                    ReactJSXRuntimeModuleId,
                                ]),
                                1,
                            ),
                            null,
                            relative(3),
                        ]),
                    ),
                ),
                {
                    uninitialized: true,
                },
            )

            if (module) return (ReactNavigationStack = module)
        },
        {
            hint: {},
        },
    )!

export interface ReactNavigationParamList {
    [Page: string]: any
}

declare global {
    namespace ReactNavigation {
        interface RootParamList extends ReactNavigationParamList {}
    }
}
