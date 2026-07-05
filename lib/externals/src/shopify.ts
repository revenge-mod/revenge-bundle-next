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
            withProps<typeof FlashList>('FlashList')
                .and(
                    // [React, JSXRuntime, (Platform), (FlashListExports), (Reanimated), (RNBottomSheet), (BottomSheet), ImportTracker]
                    withDependencies([
                        ReactModuleId,
                        ReactJSXRuntimeModuleId,
                        null,
                        null,
                        null,
                        null,
                        null,
                        // TODO: Decouple?
                        ImportTrackerModuleId,
                    ]).or(
                        // TODO: Remove when stable > 337206
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
                .keyAs('revenge.externals.Shopify.FlashList'),
        )

        if (module) return (FlashList = module)
    },
    {
        hint: {},
    },
)!
