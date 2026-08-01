import { waitForModules } from '@revenge-mod/modules/finders'
import { withProps } from '@revenge-mod/modules/finders/filters'
import type { Metro } from '@revenge-mod/modules/types'

export let ReactModuleId: Metro.ModuleID
export let ReactNativeModuleId: Metro.ModuleID
export let ReactJSXRuntimeModuleId: Metro.ModuleID

export let React: typeof import('react')
export let ReactNative: typeof import('react-native')
export let ReactJSXRuntime: typeof import('react/jsx-runtime')

let RtCount = 0

const unsubRt = waitForModules(
    withProps<typeof React>('useState'),
    (exports, id) => {
        // React has 2 modules re-exporting it, the second of which, is the one that modules requires from
        if (RtCount++ === 2) return unsubRt()

        ReactModuleId = id
        React = exports
    },
)

const unsubRN = waitForModules(
    withProps<typeof ReactNative>('AppRegistry'),
    (exports, id) => {
        unsubRN()

        ReactNativeModuleId = id
        ReactNative = exports

        // @as-require
        import('./native/patches')
    },
    {
        cached: true,
    },
)

let RJsxRCount = 0

const unsubRJSXR = waitForModules(
    withProps<typeof ReactJSXRuntime>('jsxs'),
    (exports, id) => {
        // React/JSXRuntime has 2 modules re-exporting it, the second of which, is the one that modules requires from
        if (RJsxRCount++ === 2) return unsubRJSXR()

        ReactJSXRuntimeModuleId = id
        ReactJSXRuntime = exports
    },
)
