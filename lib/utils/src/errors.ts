export function getErrorStack(e: unknown) {
    return e instanceof Error ? e.stack : String(e)
}

export function getCurrentStack() {
    const { stack } = new Error()
    return stack!.split('\n').slice(2).join('\n')
}
