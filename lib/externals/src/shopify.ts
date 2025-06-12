import {
    byDependencies,
    byProps,
    preferExports,
} from '@revenge-mod/modules/finders/filters'
import { lookupModule } from '@revenge-mod/modules/finders/lookup'
import {
    ReactJsxRuntimeModuleId,
    ReactModuleId,
    ReactNativeModuleId,
} from '@revenge-mod/react'
import { proxify } from '@revenge-mod/utils/proxy'

export let FlashList: typeof import('@shopify/flash-list') = proxify(
    () => {
        const [module] = lookupModule(
            preferExports(
                byProps<typeof FlashList>('FlashList'),
                byDependencies([
                    ReactModuleId,
                    ReactNativeModuleId,
                    ReactJsxRuntimeModuleId,
                    undefined,
                    undefined,
                    undefined,
                    2,
                    undefined,
                ]),
                // Dependencies. One in brackets are dynamic or late initialized.
                // [React, RN, JSXRuntime, (FlashListExports), (Reanimated), (RNBottomSheet), ImportTracker, (BottomSheetFlashList)]
            ),
            {
                includeUninitialized: true,
            },
        )

        if (module) return (FlashList = module)
    },
    {
        hint: 'object',
    },
)!
