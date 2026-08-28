import type { Metro } from '../types'
import type { Filter } from './filters'
import type { WaitForModulesOptions } from './wait'

export * from './_internal'

export const DEBUG_waitStatuses: Array<{
    ids: Metro.ModuleID[]
    filter: Filter<any>
    options: WaitForModulesOptions
}> = []
