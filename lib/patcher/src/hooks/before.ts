import {
    createPatchedFunctionProxy,
    patchedFunctionProxyStates,
    unproxy,
} from '../_internal'
import type { HookNode, PatchedFunctionProxyState } from '../_internal'
import type { BeforeHook, FiniteDomain, UnknownFunction } from '../types'

function unpatchBefore<T extends UnknownFunction>(
    state: PatchedFunctionProxyState<PropertyKey, T>,
    hookNode: HookNode<BeforeHook<T>>,
) {
    if (hookNode.unpatched) return

    hookNode.unpatched = true
    hookNode.hook = undefined

    const { prev, next } = hookNode
    if (prev === undefined) {
        state.before = next
        if (next === undefined) {
            if (state.instead === undefined && state.after === undefined)
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

export function before<
    Parent extends Record<Key, UnknownFunction>,
    Key extends keyof Parent,
>(parent: Parent, key: Key, hook: BeforeHook<Parent[Key]>): () => void
export function before<Key extends PropertyKey, Value extends UnknownFunction>(
    parent: Record<Key, Value>,
    key: FiniteDomain<Key>,
    hook: BeforeHook<Value>,
) {
    const target = parent[key]

    let state = patchedFunctionProxyStates.get(target)
    let hookNode: HookNode<typeof hook>
    if (state?.parent === parent && state.key === key) {
        const head = state.before
        hookNode = {
            hook,
            next: head,
            prev: undefined,
            unpatched: false,
        }
        if (head) head.prev = hookNode
        state.before = hookNode
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
            hookNode,
            undefined,
            undefined,
        )
    }

    return unpatchBefore.bind(undefined, state, hookNode)
}
