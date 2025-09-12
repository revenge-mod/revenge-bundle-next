// Initialize init libraries
import '@revenge-mod/react/init'
import '@revenge-mod/storage/init'

import { onRunApplication } from '@revenge-mod/react/native'
import { onError } from '~preinit'

const unsub = onRunApplication(() => {
    unsub()

    try {
        // @as-require
        import('./start')
    } catch (e) {
        onError(e)
    }
})

// Run all init plugins
// @as-require
import '~/plugins/init'
// @as-require
import '@revenge-mod/plugins/init'
