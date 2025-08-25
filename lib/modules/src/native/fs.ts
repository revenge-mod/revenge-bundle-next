import {
    callBridgeMethod,
    callBridgeMethodSync,
} from '@revenge-mod/modules/native'

export function readFile(path: string) {
    return callBridgeMethod('revenge.fs.read', [path])
}

export function writeFile(path: string, data: string) {
    return callBridgeMethod('revenge.fs.write', [path, data])
}

export function exists(path: string) {
    return callBridgeMethod('revenge.fs.exists', [path])
}

export function rm(path: string) {
    return callBridgeMethod('revenge.fs.delete', [path])
}

export function readFileSync(path: string) {
    return callBridgeMethodSync('revenge.fs.read', [path])
}

export function writeFileSync(path: string, data: string) {
    return callBridgeMethodSync('revenge.fs.write', [path, data])
}

export function rmSync(path: string) {
    return callBridgeMethodSync('revenge.fs.exists', [path])
}

export function deleteFileSync(path: string) {
    return callBridgeMethodSync('revenge.fs.delete', [path])
}

declare module '@revenge-mod/modules/native' {
    export interface Methods {
        'revenge.fs.read': [[path: string], string]
        'revenge.fs.write': [[path: string, data: string], void]
        'revenge.fs.exists': [[path: string], boolean]
        'revenge.fs.delete': [[path: string], boolean]
    }
}
