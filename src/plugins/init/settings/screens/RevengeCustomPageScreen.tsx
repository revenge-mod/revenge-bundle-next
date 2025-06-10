import { useLayoutEffect } from 'react'
import type { StackScreenProps } from '@react-navigation/stack'
import type { ReactNavigationParamList } from '@revenge-mod/externals/react-navigation'
import type { RouteNames, Setting } from '../constants'

export default function RevengeCustomPageScreen({
    route,
    navigation,
}: StackScreenProps<
    ReactNavigationParamList,
    (typeof RouteNames)[(typeof Setting)['RevengeCustomPage']]
>) {
    const { render: PageComponent, options } = route.params

    // biome-ignore lint/correctness/useExhaustiveDependencies: We only want to set options once
    useLayoutEffect(() => {
        if (options) navigation.setOptions(options)
    }, [])

    return <PageComponent />
}
