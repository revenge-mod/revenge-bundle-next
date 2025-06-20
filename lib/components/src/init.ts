import { _uapi } from '@revenge-mod/plugins/_'
import { defineLazyProperty } from '@revenge-mod/utils/objects'
import type { UnscopedInitPluginApi } from '@revenge-mod/plugins/types'

const uapi = _uapi as UnscopedInitPluginApi

defineLazyProperty(uapi, 'components', () => {
    return require('.')
})
