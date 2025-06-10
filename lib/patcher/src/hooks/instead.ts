import {
    createPatchedFunctionProxy,
    patchedFunctionProxyHandler,
    patchedFunctionProxyStates,
    unproxy,
} from '../_internal'
import type {
    FunctionProxyState,
    InsteadHookNode,
    PatchedFunctionProxyState,
} from '../_internal'
import type {
    AbstractNewable,
    Callable,
    FiniteDomain,
    InsteadHook,
    UnknownFunction,
} from '../types'

const insteadHookProxyHandler = {
    ...patchedFunctionProxyHandler,
    apply<T extends Callable>(
        hookNode: InsteadHookNode<T>,
        receiver: ThisParameterType<T>,
        args: Parameters<T>,
    ) {
        const { next, hook } = hookNode
        return Reflect.apply(hook!, receiver, [
            args,
            next === undefined ? hookNode.target : next.proxy,
        ])
    },
    construct<T extends AbstractNewable<never, object>>(
        hookNode: InsteadHookNode<T>,
        args: ConstructorParameters<T>,
        ctor: AbstractNewable,
    ) {
        const { next, hook } = hookNode
        return Reflect.construct(
            hook!,
            [args, next === undefined ? hookNode.target : next.proxy],
            ctor,
        )
    },
} as const satisfies Required<ProxyHandler<FunctionProxyState>>

function unpatchInstead<T extends UnknownFunction>(
    state: PatchedFunctionProxyState<PropertyKey, T>,
    hookNode: InsteadHookNode<T>,
) {
    if (hookNode.unpatched) return

    hookNode.unpatched = true
    hookNode.hook = undefined

    const { prev, next } = hookNode
    if (prev === undefined) {
        state.instead = next
        if (next === undefined) {
            if (state.before === undefined && state.after === undefined)
                unproxy(state)
            return
        }
    } else {
        prev.next = next
        hookNode.prev = undefined
        if (next === undefined) return
    }
    next.prev = prev
    hookNode.next = undefined
}

export function instead<
    Parent extends Record<Key, UnknownFunction>,
    Key extends keyof Parent,
>(parent: Parent, key: Key, hook: InsteadHook<Parent[Key]>): () => void
export function instead<Key extends PropertyKey, Value extends UnknownFunction>(
    parent: Record<Key, Value>,
    key: FiniteDomain<Key>,
    hook: InsteadHook<Value>,
) {
    const target = parent[key]

    let state = patchedFunctionProxyStates.get(target)

    // biome-ignore lint/complexity/useArrowFunction: We need a function that has a constructor
    const hookNode = function () {}
    // The handler makes the proxy behave as target.
    hookNode.proxy = new Proxy<any>(hookNode, insteadHookProxyHandler) as Value
    hookNode.target = target
    hookNode.unpatched = false
    hookNode.hook = hook
    hookNode.prev = undefined

    if (state?.parent === parent && state.key === key) {
        const head = state.instead
        hookNode.next = head
        if (head) head.prev = hookNode
        state.instead = hookNode
    } else {
        hookNode.next = undefined
        state = createPatchedFunctionProxy(
            target,
            parent,
            key,
            undefined,
            hookNode,
            undefined,
        )
    }

    return unpatchInstead.bind(undefined, state, hookNode)
}
