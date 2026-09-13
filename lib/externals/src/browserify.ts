import { lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { proxify } from '@revenge-mod/utils/proxy'

const { partial, relative } = withDependencies

export let nodeUtil: typeof import('node:util') = proxify(
    () => {
        const [module] = lookupModule(
            withProps<typeof nodeUtil>('inspect').and(
                withDependencies([
                    partial([relative(2, true), relative(4, true)]),
                    [],
                    [],
                ]),
            ),
        )

        if (module) return (nodeUtil = module)
    },
    {
        hint: {},
    },
)!
