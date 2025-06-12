import {
    byDependencies,
    byProps,
    looseDeps,
    preferExports,
    relativeDep,
} from '@revenge-mod/modules/finders/filters'
import { lookupModule } from '@revenge-mod/modules/finders/lookup'
import { proxify } from '@revenge-mod/utils/proxy'

export let nodeUtil: typeof import('node:util') = proxify(
    () => {
        const [module] = lookupModule(
            preferExports(
                byProps<typeof nodeUtil>('inspect'),
                byDependencies([
                    looseDeps([relativeDep(2, true), relativeDep(4, true)]),
                    [],
                    [],
                ]),
            ),
            {
                includeUninitialized: true,
            },
        )

        if (module) return (nodeUtil = module)
    },
    {
        hint: 'object',
    },
)!
