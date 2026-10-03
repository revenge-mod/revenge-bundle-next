import { ImportTrackerModuleId } from '@revenge-mod/discord/common/import-tracker'
import { lookupModule } from '@revenge-mod/modules/finders'
import {
    anyOf,
    withDependencies,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import {
    ReactJSXRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'

const { partial, relative } = withDependencies

export let FlashList: typeof import('@shopify/flash-list') = proxify(
    () => {
        const [module] = lookupModule(
            withProps<typeof FlashList>('FlashList')
                .and(
                    anyOf(
                        // [isNewArch, ErrorMessages, FlashList, ...]
                        withDependencies(
                            partial([
                                // isNewArch: [ReactNative]
                                relative.withDependencies(
                                    [ReactNativeModuleId],
                                    1,
                                ),
                                relative(2),
                                // FlashList: [RecyclerView]
                                relative.withDependencies([relative(1)], 3),
                            ]),
                        ),
                        // TODO: Remove when stable > 349205
                        withDependencies([
                            ReactModuleId,
                            ReactNativeModuleId,
                            ReactJSXRuntimeModuleId,
                            null,
                            null,
                            null,
                            null,
                            null,
                            ImportTrackerModuleId,
                        ]),
                    ),
                )
                .keyAs('revenge.externals.Shopify.FlashList'),
        )

        if (module) return (FlashList = module)
    },
    {
        hint: {},
    },
)!
