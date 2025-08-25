// Initialize init libraries
import '@revenge-mod/react/init'
import '@revenge-mod/storage/init'

import { onRunApplication } from '@revenge-mod/react/native'
import { onError } from '~preinit'

const unsub = onRunApplication(() => {
    unsub()

    try {
        require('./start')
    } catch (e) {
        onError(e)
    }
})

// Run all init plugins
require('~/plugins/init')
require('@revenge-mod/plugins/init')
