import '@revenge-mod/modules/metro/patches'
import '@revenge-mod/utils/patches/proxy'

import {
    onModuleFirstRequired,
    onModuleInitialized,
} from '@revenge-mod/modules/metro/subscriptions'
import { callBridgeMethod } from '@revenge-mod/modules/native'
import { getErrorStack } from '@revenge-mod/utils/error'
import { BuildEnvironment, FullVersion } from '~constants'

const IndexModuleId = 0

onModuleFirstRequired(IndexModuleId, function onIndexRequired() {
    try {
        if (__BUILD_FLAG_LOG_PROMISE_REJECTIONS__)
            require('./patches/log-promise-rejections')

        if (__DEV__)
            nativeLoggingHook(`\u001b[31m--- PREINIT STAGE ---\u001b[0m`, 1)

        // Initialize preinit libraries
        require('@revenge-mod/react/preinit')
        require('@revenge-mod/assets/preinit')
        require('@revenge-mod/discord/preinit')

        onModuleInitialized(IndexModuleId, function onIndexInitialized() {
            if (__DEV__)
                nativeLoggingHook(`\u001b[31m--- INIT STAGE ---\u001b[0m`, 1)

            try {
                require('./init')
            } catch (e) {
                onError(e)
            }
        })

        // Run all preinit plugins
        require('~/plugins/preinit')
        require('@revenge-mod/plugins/preinit')
    } catch (e) {
        onError(e)
    }
})

export function onError(error: unknown) {
    const stack = getErrorStack(error) ?? String(error)

    callBridgeMethod('revenge.alertError', [
        stack,
        `${FullVersion} (${BuildEnvironment})`,
    ])

    nativeLoggingHook(`\u001b[31m${stack}\u001b[0m`, 2)
}

declare module '@revenge-mod/modules/native' {
    export interface Methods {
        'revenge.alertError': [[error: string, title?: string], void]
    }
}
