import {
    callNativeMethod,
    callNativeMethodSync,
} from '@revenge-mod/modules/native'

export function readFile(path: string) {
    return callNativeMethod('revenge.fs.read', [path])
}

export function writeFile(path: string, data: string) {
    return callNativeMethod('revenge.fs.write', [path, data])
}

export function exists(path: string) {
    return callNativeMethod('revenge.fs.exists', [path])
}

export function rm(path: string) {
    return callNativeMethod('revenge.fs.delete', [path])
}

export function existsSync(path: string) {
    return callNativeMethodSync('revenge.fs.exists', [path])
}

export function readFileSync(path: string) {
    return callNativeMethodSync('revenge.fs.read', [path])
}

export function writeFileSync(path: string, data: string) {
    return callNativeMethodSync('revenge.fs.write', [path, data])
}

export function rmSync(path: string) {
    return callNativeMethodSync('revenge.fs.exists', [path])
}

export function deleteFileSync(path: string) {
    return callNativeMethodSync('revenge.fs.delete', [path])
}

export function getConstants() {
    return callNativeMethodSync('revenge.fs.getConstants', [])
}

declare module '@revenge-mod/modules/native' {
    export interface Methods {
        'revenge.fs.getConstants': [
            [],
            {
                data: string
                files: string
                cache: string
            },
        ]
        'revenge.fs.read': [[path: string], string]
        'revenge.fs.write': [[path: string, data: string], void]
        'revenge.fs.exists': [[path: string], boolean]
        'revenge.fs.delete': [[path: string], boolean]
    }
}
