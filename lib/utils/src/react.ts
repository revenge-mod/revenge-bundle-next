// @revenge-mod/storage depends on this file, and it is imported way too early, so we can't import our shim
import { React } from '@revenge-mod/react'
import { findInTree } from './trees'
import type { ReactNode } from 'react'
import type { SearchFilter } from './trees'

export function useIsFirstRender() {
    let firstRender = false

    React.useEffect(() => {
        firstRender = true
    }, [])

    return firstRender
}

export function useReRender() {
    const [, forceUpdate] = React.useReducer(x => ~x, 0)
    return forceUpdate
}

const ReactFiberWalkable = new Set(['props', 'children', 'child', 'sibling'])

export function findInReactFiber<F extends SearchFilter>(
    tree: Extract<ReactNode, object>,
    filter: F,
) {
    return findInTree<F>(tree, filter, {
        walkable: ReactFiberWalkable,
    })
}
