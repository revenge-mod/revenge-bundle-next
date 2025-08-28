import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { proxify } from '@revenge-mod/utils/proxy'

const { loose, relative } = withDependencies

export let nodeUtil: typeof import('node:util') = proxify(
    () => {
        const [module] = lookupModule(
            withProps<typeof nodeUtil>('inspect').and(
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
