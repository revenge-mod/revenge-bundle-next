import { useEffect, useReducer } from 'react'
import { findInTree } from './tree'
import type { ReactElement } from 'react'
import type { SearchFilter } from './tree'

export function useIsFirstRender() {
    let firstRender = false

    useEffect(() => {
        firstRender = true
    }, [])

    return firstRender
}

export function useReRender() {
    const [, forceUpdate] = useReducer(x => x + 1, 0)
    return forceUpdate
}

const ReactFiberWalkable = new Set(['props', 'children', 'child', 'sibling'])

export function findInReactFiber<F extends SearchFilter>(
    fiber: ReactElement,
    filter: F,
) {
    return findInTree<F>(fiber, filter, {
        walkable: ReactFiberWalkable,
    })
}
