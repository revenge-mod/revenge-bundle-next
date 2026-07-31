import { callNativeMethodSync } from '@revenge-mod/modules/native'

export function reloadApp() {
    callNativeMethodSync('revenge.app.reload', [])
}

declare module '@revenge-mod/modules/native' {
    interface NativeMethods {
        'revenge.app.reload': [[], null]
    }
}
