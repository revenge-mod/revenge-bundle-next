import { ImportTrackerModuleId } from '@revenge-mod/discord/common'
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

export let FlashList: typeof import('@shopify/flash-list') = proxify(
    () => {
        const [module] = lookupModule(
            withProps<typeof FlashList>('FlashList').and(
                // Dependencies. One in brackets are dynamic or late initialized.
                // [React, RN, JSXRuntime, (FlashListExports), (Reanimated), (RNBottomSheet), ImportTracker, (BottomSheetFlashList)]
                withDependencies([
                    ReactModuleId,
                    ReactNativeModuleId,
                    ReactJSXRuntimeModuleId,
                    null,
                    null,
                    null,
                    // TODO: Decouple?
                    ImportTrackerModuleId,
                    null,
                ]),
            ),
        )

        if (module) return (FlashList = module)
    },
    {
        hint: {},
    },
)!
