import { lookupModule } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import type { Metro } from '@revenge-mod/modules/types'

// ../discord_common/js/packages/tokens/native.tsx
export const [Tokens, TokensModuleId] = lookupModule(withProps('RawColor')) as [
    any,
    Metro.ModuleID,
]
