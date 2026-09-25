import {
    callNativeMethod,
    callNativeMethodSync,
} from '@revenge-mod/modules/native'
import { PluginSystemError } from './errors'
import type {
    MethodArgs,
    MethodName,
    MethodResult,
} from '@revenge-mod/modules/native'
import type { PluginSystemErrorPayload } from './errors'

type PluginMethodEnvelope<T> =
    | { result: T }
    | { error: PluginSystemErrorPayload }

function unwrap<T>(raw: unknown): T {
    const envelope = raw as PluginMethodEnvelope<T>

    if (envelope && typeof envelope === 'object') {
        if ('error' in envelope) throw new PluginSystemError(envelope.error)
        if ('result' in envelope) return envelope.result
    }

    throw new PluginSystemError({
        code: 'UNKNOWN',
        message: `Malformed plugin system response: ${String(raw)}`,
    })
}

export async function callPluginSystemMethod<N extends MethodName>(
    name: N,
    args: MethodArgs<N>,
): Promise<MethodResult<N>> {
    return unwrap<MethodResult<N>>(
        await (
            callNativeMethod as (n: N, a: MethodArgs<N>) => Promise<unknown>
        )(name, args),
    )
}

export function callPluginSystemMethodSync<N extends MethodName>(
    name: N,
    args: MethodArgs<N>,
): MethodResult<N> {
    return unwrap<MethodResult<N>>(
        (callNativeMethodSync as (n: N, a: MethodArgs<N>) => unknown)(
            name,
            args,
        ),
    )
}
