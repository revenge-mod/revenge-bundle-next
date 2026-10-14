/**
 * Marks filters made by `namespaceOnly`, so `runFilter` doesn't run them against the `default` export at all.
 * Copies of a filter (eg. from `scope()`) keep it, along with the key.
 */
export const NamespaceOnlyMark = Symbol('revenge.namespaceOnly')

export interface MaybeNamespaceOnly {
    [NamespaceOnlyMark]?: true
}
