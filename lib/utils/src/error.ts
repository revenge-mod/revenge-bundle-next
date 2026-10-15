export function getErrorStack(e: unknown): string {
    if (e instanceof Error) {
        const stack = e.stack ?? String(e)
        return e.cause
            ? `${stack}\n\nCaused by: ${getErrorStack(e.cause)}`
            : stack
    } else {
        return String(e)
    }
}

export function getCurrentStack() {
    const { stack } = new Error()

    let newlineCount = 0

    for (let i = 0; i < stack!.length; i++)
        if (stack![i] === '\n' && newlineCount++ === 1)
            return stack!.slice(i + 1)

    return stack!.slice(stack!.indexOf('\n') + 1)
}
