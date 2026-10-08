import { stat } from 'fs/promises'

export const exists = async (path: string) => {
    try {
        await stat(path)
        return true
    } catch {
        return false
    }
}

export function isEmpty(value: string | undefined): boolean {
    return value === undefined || value === ''
}

export function boolEnv(key: string, defaultValue: boolean): boolean {
    const val = process.env[key]
    if (isEmpty(val)) return defaultValue
    return val === 'true' || val === '1'
}

export function stringEnv(
    key: string,
    defaultValue?: string,
    required: boolean = true,
): string {
    const val = process.env[key]
    if (isEmpty(val)) {
        if (defaultValue === undefined) {
            if (required)
                throw new Error(`Environment variable ${key} is required`)
            return 'undefined'
        }
        return JSON.stringify(defaultValue)
    }
    return JSON.stringify(val)
}
