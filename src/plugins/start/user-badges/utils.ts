import { cloneElement, isValidElement } from 'react'
import type { FC, ReactElement, ReactNode } from 'react'

type AnyElement = ReactElement<Record<string, any>>

export type ElementVisitor = (
    element: AnyElement,
) => Record<string, any> | undefined

/** Copies a rendered element tree, merging in the props the visitor returns. */
export function mapElementTree(
    node: ReactNode,
    visit: ElementVisitor,
): ReactNode {
    if (Array.isArray(node)) {
        let changed = false

        const next = node.map(child => {
            const mapped = mapElementTree(child, visit)
            if (mapped !== child) changed = true
            return mapped
        })

        return changed ? next : node
    }

    if (!isValidElement(node)) return node

    const element = node as AnyElement
    const patch = visit(element)

    // The visitor took over the subtree, so don't descend into it
    if (patch && 'children' in patch) return cloneElement(element, patch)

    const { children } = element.props
    const nextChildren =
        children === undefined ? children : mapElementTree(children, visit)

    // Nothing below matched either, so hand back the very same element
    if (!patch && nextChildren === children) return node

    return cloneElement(
        element,
        nextChildren === children
            ? patch
            : { ...patch, children: nextChildren },
    )
}

const patchedComponents = new WeakMap<FC<any>, FC<any>>()

export type RenderPatch<P, C = void> = (
    rendered: ReactNode,
    props: P,
    context: C,
) => ReactNode

/**
 * Creates and caches a component rendering `Component`, passing its output through `patch`.
 *
 * @param Component The component to wrap. Called directly, so its hooks belong to the wrapper.
 * @param patch The patch to apply to the rendered output. Must not call hooks.
 * @param useContext Provides whatever the patch needs from hooks. Always called, before the component renders.
 * @returns The wrapper component.
 */
export function patchRender<P extends object, C = void>(
    Component: FC<P>,
    patch: RenderPatch<P, C>,
    useContext?: () => C,
): FC<P> {
    const cached = patchedComponents.get(Component)
    if (cached) return cached

    const Patched: FC<P> = props => {
        const context = useContext?.() as C
        const rendered = Component(props)

        return rendered instanceof Promise
            ? rendered.then(node => patch(node, props, context))
            : patch(rendered, props, context)
    }

    Object.defineProperty(Patched, 'name', {
        value: `Patched(${Component.name || 'Component'})`,
    })

    patchedComponents.set(Component, Patched)

    return Patched
}
