import { ReactJsxRuntime } from '@revenge-mod/react'
import { isProxified, unproxify } from '@revenge-mod/utils/proxy'
import type { ElementType } from 'react'

const { jsx: _jsx, jsxs: _jsxs, Fragment } = ReactJsxRuntime

const jsx = ((type, ...args) =>
    _jsx(unproxy(type as object), ...args)) as typeof _jsx

const jsxs = ((type, ...args) => {
    return _jsxs(unproxy(type as object), ...args)
}) as typeof _jsxs

function unproxy(type: object): ElementType {
    return (isProxified(type)
        ? unproxify(type)
        : type) as unknown as ElementType
}

module.exports = { jsx, jsxs, Fragment }
