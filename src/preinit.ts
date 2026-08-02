import '@revenge-mod/modules/metro/patches'

import {
    onModuleFirstRequired,
    onModuleInitialized,
} from '@revenge-mod/modules/metro/subscriptions'
import { onError } from '~index'

const IndexModuleId = 0

onModuleFirstRequired(IndexModuleId, function onIndexRequired() {
    try {
        if (__BUILD_FLAG_LOG_PROMISE_REJECTIONS__)
            // @as-require
            import('./patches/log-promise-rejections')

        if (__DEV__)
            nativeLoggingHook(`\u001b[31m--- PREINIT STAGE ---\u001b[0m`, 1)

        // Initialize preinit libraries
        // @as-require
        import('@revenge-mod/react/preinit')
        // @as-require
        import('@revenge-mod/assets/preinit')
        // @as-require
        import('@revenge-mod/discord/preinit')

        onModuleInitialized(IndexModuleId, function onIndexInitialized() {
            if (__DEV__)
                nativeLoggingHook(`\u001b[31m--- INIT STAGE ---\u001b[0m`, 1)

            try {
                // @as-require
                import('./init')
            } catch (e) {
                onError(e)
            }
        })

        // Run all preinit plugins
        // @as-require
        import('~/plugins/preinit')
        // @as-require
        import('@revenge-mod/plugins/preinit')
    } catch (e) {
        onError(e)
    }
})
