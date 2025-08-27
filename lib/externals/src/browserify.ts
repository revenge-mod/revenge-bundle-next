import { lookupModule } from '@revenge-mod/modules/finders'
import {
    preferExports,
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { proxify } from '@revenge-mod/utils/proxy'

const { loose, relative } = withDependencies

export let nodeUtil: typeof import('node:util') = proxify(
    () => {
        const [module] = lookupModule(
            preferExports(
                withProps<typeof nodeUtil>('inspect'),
                withDependencies([
                    loose([relative(2, true), relative(4, true)]),
                    [],
                    [],
                ]),
            ),
            {
                uninitialized: true,
            },
        )

        if (module) return (nodeUtil = module)
    },
    {
        hint: {},
    },
)!
