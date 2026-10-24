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
    HookOptions,
    InsteadHook,
    UnknownFunction,
    UnpatchFunction,
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

/**
 * Instead hooks allow you to completely replace the original function with a new one, while still being able to call the original function if needed.
 *
 * ```js
 * import { instead } from '@revenge-mod/patcher'
 *
 * const obj = {
 *     method: (a) => {
 *         console.log('Original method called with:', a)
 *         return 'original result'
 *     }
 * }
 *
 * instead(obj, 'method', ([a], original) => {
 *     console.log('Instead method called with:', a)
 *     // Call the original function if needed
 *     const originalResult = original('modified')
 *     console.log('Original method was called')
 *
 *     // Return a new value
 *     return 'new value'
 * })
 *
 * console.log(obj.method('test')) // 'new value'
 * // CONSOLE OUTPUT:
 * // Instead method called with: test
 * // Original method called with: modified
 * // Original method was called
 * // new value
 * ```
 *
 * @param parent The parent object containing the method to patch.
 * @param key The key of the method to patch.
 * @param hook The hook function to execute instead of the original method.
 * @param options Optional configuration including priority.
 *
 * @return A function to unpatch.
 */
export function instead<
    Parent extends Record<Key, UnknownFunction>,
    Key extends keyof Parent,
>(
    parent: Parent,
    key: Key,
    hook: InsteadHook<Parent[Key]>,
    options?: HookOptions,
): UnpatchFunction
export function instead<Key extends PropertyKey, Value extends UnknownFunction>(
    parent: Record<Key, Value>,
    key: FiniteDomain<Key>,
    hook: InsteadHook<Value>,
    options?: HookOptions,
): UnpatchFunction {
    const target = parent[key]
    const priority = options?.priority ?? 0

    let state = patchedFunctionProxyStates.get(target)

    // biome-ignore lint/complexity/useArrowFunction: We need a function that has a constructor
    const hookNode = function () {}
    // The handler makes the proxy behave as target.
    hookNode.proxy = new Proxy<any>(hookNode, insteadHookProxyHandler) as Value
    hookNode.target = target
    hookNode.unpatched = false
    hookNode.hook = hook
    hookNode.priority = priority
    hookNode.prev = undefined

    if (state?.parent === parent && state.key === key) {
        // We already patched this function. Point to the actual target, not the proxy.
        hookNode.target = state.target

        let current = state.instead
        let prev: InsteadHookNode<Value> | undefined

        while (current && current.priority > priority) {
            prev = current
            current = current.next
        }

        hookNode.next = current

        if (prev) {
            prev.next = hookNode
            hookNode.prev = prev
        } else {
            state.instead = hookNode
        }

        if (current) {
            current.prev = hookNode
        }
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
