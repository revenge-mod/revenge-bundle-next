// Globals declared for this codebase ONLY!

// React Native declares `HermesInternal` as `null | {}`, so shipping a stricter redeclaration would give consumers an error.
// This repository doesn't use React Native types, so it can use a stricter declaration.

declare const HermesInternal: HermesInternalObject
