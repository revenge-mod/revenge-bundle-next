import {
    byDependencies,
    byName,
    byProps,
    every,
    looseDeps,
    preferExports,
    relativeDep,
} from '@revenge-mod/modules/finders/filters'
import { lookupModule } from '@revenge-mod/modules/finders/lookup'
import { ReactJsxRuntimeModuleId, ReactModuleId } from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'

const [, _createClassModuleId] = lookupModule(byName('_createClass'))
const [, _classCallCheckModuleId] = lookupModule(byName('_classCallCheck'))

export let ReactNavigationNative: typeof import('@react-navigation/native') =
    proxify(
        () => {
            const [module] = lookupModule(
                preferExports(
                    byProps<typeof ReactNavigationNative>('useLinkTo'),
                    byDependencies(
                        looseDeps([
                            [],
                            looseDeps([
                                [_createClassModuleId, _classCallCheckModuleId],
                            ]),
                        ]),
                    ),
                ),
                {
                    includeUninitialized: true,
                },
            )

            if (module) return (ReactNavigationNative = module)
        },
        {
            hint: 'object',
        },
    )!

export let ReactNavigationStack: typeof import('@react-navigation/stack') =
    proxify(
        () => {
            const [module] = lookupModule(
                preferExports(
                    byProps<typeof ReactNavigationStack>(
                        'createStackNavigator',
                    ),
                    every(
                        byDependencies(
                            looseDeps([
                                looseDeps([
                                    [[]],
                                    ReactModuleId,
                                    ReactJsxRuntimeModuleId,
                                ]),
                            ]),
                        ),
                        byDependencies(
                            looseDeps([
                                relativeDep(1),
                                undefined,
                                relativeDep(3),
                            ]),
                        ),
                    ),
                ),
                {
                    includeUninitialized: true,
                },
            )

            if (module) return (ReactNavigationStack = module)
        },
        {
            hint: 'object',
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
