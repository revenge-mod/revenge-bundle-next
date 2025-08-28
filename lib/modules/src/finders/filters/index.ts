import { FilterFlag } from './constants'
import { createFilterGenerator } from './utils'
import type { Filter, FilterGenerator } from './utils'

export * from './constants'
export * from './utils'

/**
 * Filter modules by their exports having all of the specified properties.
 *
 * @param prop The property to check for.
 * @param props More properties to check for (optional).
 *
 * @example
 * ```ts
 * const [React] = lookupModule(withProps<typeof import('react')>('createElement'))
 * // const React: typeof import('react')
 * ```
 */
export const withProps = createFilterGenerator<Parameters<WithProps>>(
    (props, _, exports) => {
        const type = typeof exports
        if (type === 'object' || type === 'function') {
            for (const prop of props) {
                if (prop in exports) continue
                return false
            }

            return true
        }

        return false
    },
    props => `revenge.props(${props.join(',')})`,
    FilterFlag.RequiresExports,
) as WithProps

export type WithProps = FilterGenerator<
    <T extends Record<string, any> = Record<string, any>>(
        prop: keyof T,
        ...props: Array<keyof T>
    ) => Filter<T, true>
>

/**
 * Filter modules by their exports having none of the specified properties.
 *
 * @param prop The property to check for.
 * @param props More properties to check for (optional).
 */
export const withoutProps = createFilterGenerator<Parameters<WithoutProps>>(
    (props, _, exports) => {
        const type = typeof exports
        if (type === 'object' || type === 'function')
            for (const prop of props) if (prop in exports) return false

        return true
    },
    props => `revenge.withoutProps(${props.join(',')})`,
    FilterFlag.RequiresExports,
) as WithoutProps

export type WithoutProps = FilterGenerator<
    <T extends Record<string, any>>(
        prop: string,
        ...props: string[]
    ) => Filter<T, true>
>

/**
 * Filter modules by their exports having only the specified property.
 *
 * @param prop The property to check for.
 *
 * @example
 * ```ts
 * const [FormSwitchModule] = lookupModule(withSingleProp('FormSwitch'))
 * // const FormSwitchModule: { FormSwitch: any }
 * ```
 */
export const withSingleProp = createFilterGenerator<Parameters<WithSingleProp>>(
    ([prop], _, exports) => {
        if (typeof exports === 'object' && prop in exports)
            return Object.keys(exports).length === 1

        return false
    },
    ([prop]) => `revenge.singleProp(${prop})`,
    FilterFlag.RequiresExports,
) as WithSingleProp

export type WithSingleProp = FilterGenerator<
    <T extends Record<string, any>>(prop: keyof T) => Filter<T, true>
>

/**
 * Filter modules by their exports having the specified name.
 *
 * Usually used for function components or classes.
 *
 * @param name The name to check for.
 *
 * @example Auto-typing as object
 * ```ts
 * const [SomeComponent] = lookupModule(withName('SomeComponent'))
 * // const SomeComponent: { name: 'SomeComponent' }
 * ```
 *
 * @example Typing as function component
 * ```ts
 * type MyComponent = React.FC<{ foo: string }>
 *
 * const [MyComponent] = lookupModule(withName<MyComponent>('MyComponent'))
 * // const MyComponent: MyComponent & { name: 'MyComponent' }
 * ```
 *
 * @example Typing as class
 * ```
 * interface SomeClass {
 *    someMethod(): void
 * }
 *
 * const [SomeClass] = lookupModule(withName<{ new(param: string): SomeClass }>('SomeClass'))
 * // const SomeClass: { new(): SomeClass, name: 'SomeClass' }
 */
export const withName = createFilterGenerator<Parameters<WithName>>(
    ([name], _, exports) => exports.name === name,
    ([name]) => `revenge.name(${name})`,
    FilterFlag.RequiresExports,
) as WithName

export type WithName = FilterGenerator<
    <T extends object = object>(name: string) => Filter<T, true>
>

export * from './composite'
export * from './dynamic'
