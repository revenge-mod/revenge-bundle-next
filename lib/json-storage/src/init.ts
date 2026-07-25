import { JsonStorage } from '@revenge-mod/json-storage'
import { useReRender } from '@revenge-mod/utils/react'
import { useLayoutEffect } from 'react'
import type { JsonStorageSubscription } from '@revenge-mod/json-storage'

const proto = JsonStorage.prototype as JsonStorage<any>
// Actual implementation of JsonStorage#use
proto.use = function (filter) {
    if (!this.cache) this.get()

    const reRender = useReRender()

    useLayoutEffect(() => {
        const sub: JsonStorageSubscription = filter
            ? (update, mode) => {
                  if (filter(update, mode)) reRender()
              }
            : reRender

        return this.subscribe(sub)
    }, [filter, reRender])

    return this.cache
}
