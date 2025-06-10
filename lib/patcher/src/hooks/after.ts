import {
    createPatchedFunctionProxy,
    patchedFunctionProxyStates,
    unproxy,
} from '../_internal'
import type { HookNode, PatchedFunctionProxyState } from '../_internal'
import type { AfterHook, FiniteDomain, UnknownFunction } from '../types'

function unpatchAfter<T extends UnknownFunction>(
    state: PatchedFunctionProxyState<PropertyKey, T>,
    hookNode: HookNode<AfterHook<T>>,
) {
    if (hookNode.unpatched) return

    hookNode.unpatched = true
    hookNode.hook = undefined

    const { prev, next } = hookNode
    if (prev === undefined) {
        state.after = next
        if (next === undefined) {
            if (state.before === undefined && state.instead === undefined)
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

export function after<
    Parent extends Record<Key, UnknownFunction>,
    Key extends keyof Parent,
>(parent: Parent, key: Key, hook: AfterHook<Parent[Key]>): () => void
export function after<Key extends PropertyKey, Value extends UnknownFunction>(
    parent: Record<Key, Value>,
    key: FiniteDomain<Key>,
    hook: AfterHook<Value>,
) {
    const target = parent[key]

    let state = patchedFunctionProxyStates.get(target)
    let hookNode: HookNode<typeof hook>
    if (state?.parent === parent && state.key === key) {
        const head = state.after
        hookNode = {
            hook,
            next: head,
            prev: undefined,
            unpatched: false,
        }
        if (head) head.prev = hookNode
        state.after = hookNode
    } else {
        hookNode = {
            hook,
            next: undefined,
            prev: undefined,
            unpatched: false,
        }
        state = createPatchedFunctionProxy(
            target,
            parent,
            key,
            undefined,
            undefined,
            hookNode,
        )
    }

    return unpatchAfter.bind(undefined, state, hookNode)
}
