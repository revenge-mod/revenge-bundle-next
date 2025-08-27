export function debounce<F extends (...args: any[]) => any>(
    func: F,
    timeout: number,
) {
    let timer: Parameters<typeof clearTimeout>[0]
    return (...args: Parameters<F>) =>
        new Promise(rs => {
            clearTimeout(timer)
            timer = setTimeout(() => {
                rs(func(...args))
            }, timeout)
        })
}

const now = (cb: () => any) => {
    cb()
}

/**
 * A function that runs the callback as soon as possible.
 * @param cb The callback to run.
 */
export const asap = (cb: (...args: any[]) => any) => {
    // @ts-expect-error
    ;(HermesInternal.useEngineQueue()
        ? // @ts-expect-error
          HermesInternal.enqueueJob
        : (globalThis.queueMicrotask ??
              globalThis.setImmediate ??
              globalThis.setTimeout ??
              now))(cb, 0)
}

export const noop = () => {}
