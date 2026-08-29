import { beforeEach, describe, expect, test, vi } from 'vitest'

const { logs, mDeps, mExports } = vi.hoisted(() => {
    const logs: string[] = []

    // dynamic.ts reads __DEV__ at import time to pick the validating wrapper
    Object.assign(globalThis, {
        __DEV__: true,
        nativeLoggingHook: (message: string) => logs.push(message),
    })

    return {
        logs,
        mDeps: new Map<number, number[]>(),
        mExports: new Map<number, unknown>(),
    }
})

const metroUtils = {
    getModuleDependencies: (id: number) => mDeps.get(id),
    getInitializedModuleExports: (id: number) => mExports.get(id),
    isModuleInitialized: (id: number) => (mExports.has(id) ? 1 : 0),
    isModuleExportBad: (exp: unknown) => exp == null,
}

// dynamic.ts imports the relative path, utils.ts imports the package specifier
vi.mock('../../metro/utils', () => metroUtils)
vi.mock('@revenge-mod/modules/metro/utils', () => metroUtils)

// Filter entries are deprecated, and resolved to a module ID when the filter is built
const mLookups = new Map<string, number>()
const lookupCalls: string[] = []

vi.mock('../lookup', () => ({
    lookupModule: (filter: { key: string }) => {
        lookupCalls.push(filter.key)
        const id = mLookups.get(filter.key)
        return id === undefined
            ? [undefined, undefined]
            : [mExports.get(id), id]
    },
}))

const { withDependencies } = await import('./dynamic')

const { atLeast, atMost, last, ordered, partial, relative, skip, unordered } =
    withDependencies

// Well-known IDs, matching the constants the real filters use
const React = 19
const ReactNative = 27
const JSXRuntime = 21
const Dispatcher = 709
const ImportTracker = 2

beforeEach(() => {
    logs.length = 0
    mDeps.clear()
    mExports.clear()
    mLookups.clear()
    lookupCalls.length = 0
})

function define(id: number, deps: number[]) {
    mDeps.set(id, deps)
    return id
}

describe('withDependencies', () => {
    describe('positional', () => {
        test('matches an exact map', () => {
            define(5, [4, 9, 2])
            expect(withDependencies([4, null, 2])(5)).toBe(true)
        })

        test('rejects a longer map without partial', () => {
            define(5, [4, 9, 2, 7])
            expect(withDependencies([4, null, 2])(5)).toBe(false)
        })

        test('partial matches the leading dependencies', () => {
            define(5, [4, 9, 2, 7])
            expect(withDependencies(partial([4, null, 2]))(5)).toBe(true)
        })

        test('last matches the trailing dependencies', () => {
            define(5, [8, 8, 4, 9, 2])
            expect(withDependencies(last([4, null, 2]))(5)).toBe(true)
        })

        test('skip moves the window and still requires the end', () => {
            define(5, [8, 8, 4, 9, 2])
            expect(withDependencies(skip(2, [4, null, 2]))(5)).toBe(true)
            expect(withDependencies(skip(1, [4, null, 2]))(5)).toBe(false)
        })

        test('skip with partial leaves the tail unconstrained', () => {
            define(5, [8, 4, 9, 2, 7])
            expect(withDependencies(skip(1, partial([4, null, 2])))(5)).toBe(
                true,
            )
        })
    })

    describe('ordered', () => {
        test('matches a subsequence with gaps anywhere', () => {
            define(5, [8, 4, 8, 9, 8, 2, 8])
            expect(withDependencies(ordered([4, 9, 2]))(5)).toBe(true)
        })

        test('matches a contiguous run', () => {
            define(5, [4, 9, 2])
            expect(withDependencies(ordered([4, 9, 2]))(5)).toBe(true)
        })

        test('rejects a violated order', () => {
            define(5, [2, 9, 4])
            expect(withDependencies(ordered([4, 9, 2]))(5)).toBe(false)
        })

        test('rejects a missing entry', () => {
            define(5, [4, 9, 7])
            expect(withDependencies(ordered([4, 9, 2]))(5)).toBe(false)
        })

        test('dynamic entries consume exactly one dependency', () => {
            define(5, [4, 8, 2])
            expect(withDependencies(ordered([4, null, 2]))(5)).toBe(true)

            // No dependency left for the dynamic entry to consume
            define(6, [4, 2])
            expect(withDependencies(ordered([4, null, 2]))(6)).toBe(false)
        })

        test('resolves relative entries against the module ID', () => {
            define(5, [8, 6, 8, 7])
            expect(
                withDependencies(ordered([relative(1), relative(2)]))(5),
            ).toBe(true)
        })

        test('respects count bounds, which are checked first', () => {
            define(5, [4, 9, 2])
            expect(withDependencies(atMost(2, ordered([4, 2])))(5)).toBe(false)
            expect(withDependencies(atLeast(3, ordered([4, 2])))(5)).toBe(true)
        })

        test('greedy matching agrees with an exhaustive search', () => {
            // Earliest-match is optimal for subsequences, so no input may disagree
            let seed = 1
            const rand = (n: number) => {
                seed = (seed * 1103515245 + 12345) % 2147483648
                return seed % n
            }

            // Entries may be assigned to any dependency, in increasing order
            const search = (
                pattern: Array<number | null>,
                text: number[],
                i: number,
                j: number,
            ): boolean => {
                if (i === pattern.length) return true
                if (j === text.length) return false

                const dep = pattern[i]

                return (
                    ((dep == null || dep === text[j]) &&
                        search(pattern, text, i + 1, j + 1)) ||
                    search(pattern, text, i, j + 1)
                )
            }

            for (let round = 0; round < 500; round++) {
                mDeps.clear()

                // Repeated IDs make an entry assignable to several positions,
                // which is the case backtracking would exist for
                const text = Array.from({ length: rand(7) }, () => rand(4) + 1)
                const pattern = Array.from({ length: rand(4) + 1 }, () =>
                    rand(4) ? rand(4) + 1 : null,
                )

                define(5, text)

                expect({
                    round,
                    matched: withDependencies(ordered([...pattern]))(5),
                }).toEqual({ round, matched: search(pattern, text, 0, 0) })
            }
        })
    })

    describe('unordered', () => {
        test('ignores position entirely', () => {
            define(5, [2, 9, 4])
            expect(withDependencies(unordered([4, 2]))(5)).toBe(true)
        })

        test('rejects a missing entry', () => {
            define(5, [2, 9])
            expect(withDependencies(unordered([4, 2]))(5)).toBe(false)
        })
    })

    describe('relative.within', () => {
        test('matches inside the range and at both bounds', () => {
            for (const id of [12, 13, 14]) {
                mDeps.clear()
                define(10, [id])
                expect(withDependencies([relative.within(2, 4)])(10)).toBe(true)
            }
        })

        test('rejects outside the range', () => {
            define(10, [15])
            expect(withDependencies([relative.within(2, 4)])(10)).toBe(false)

            define(11, [12])
            expect(withDependencies([relative.within(2, 4)])(11)).toBe(false)
        })

        test('a zero width range behaves like relative', () => {
            define(10, [12])
            expect(withDependencies([relative.within(2, 2)])(10)).toBe(true)
            expect(withDependencies([relative(2)])(10)).toBe(true)

            define(11, [14])
            expect(withDependencies([relative.within(2, 2)])(11)).toBe(false)
        })

        test('handles negative ranges', () => {
            define(10, [8])
            expect(withDependencies([relative.within(-3, -1)])(10)).toBe(true)

            define(11, [7])
            expect(withDependencies([relative.within(-3, -1)])(11)).toBe(false)
        })

        test('resolves against the root inside a nested set', () => {
            define(10, [11])
            define(11, [13])

            expect(withDependencies([[relative.within(2, 4, true)]])(10)).toBe(
                true,
            )
        })
    })

    describe('recorded layouts', () => {
        // modules/action_sheet/native/ActionSheetActionCreators.tsx
        const actionSheet = withDependencies(
            ordered([
                React,
                JSXRuntime,
                Dispatcher,
                relative(1),
                relative(2),
                ImportTracker,
            ]),
        )

        test('one ordered set matches both ActionSheetActionCreators layouts', () => {
            // <= 344.1
            define(4411, [
                109,
                React,
                JSXRuntime,
                Dispatcher,
                4412,
                4413,
                1892,
                2,
            ])
            expect(actionSheet(4411)).toBe(true)

            // 344.2, one dependency inserted at index 2
            mDeps.clear()
            define(4411, [
                109,
                React,
                4154,
                JSXRuntime,
                Dispatcher,
                4412,
                4413,
                1892,
                2,
            ])
            expect(actionSheet(4411)).toBe(true)
        })

        // actions/native/AlertActionCreators.tsx
        const alert = withDependencies([
            null,
            null,
            [ReactNative, ImportTracker],
            relative(1),
            relative.within(2, 3),
            ImportTracker,
        ])

        test('one range matches both AlertActionCreators layouts', () => {
            // Pre-344201, the pin sat at +2
            define(4746, [32, 644, 705, 4747, 4748, 2])
            define(705, [ReactNative, ImportTracker])
            expect(alert(4746)).toBe(true)

            // 344201, the pin moved to +3
            mDeps.clear()
            define(4746, [32, 644, 705, 4747, 4749, 2])
            define(705, [ReactNative, ImportTracker])
            expect(alert(4746)).toBe(true)
        })

        test('the range still rejects a pin outside it', () => {
            define(4746, [32, 644, 705, 4747, 4750, 2])
            define(705, [ReactNative, ImportTracker])
            expect(alert(4746)).toBe(false)
        })
    })

    describe('deprecated filter entries', () => {
        function entry(key: string) {
            const filter = (() => false) as any
            filter.key = key
            return filter
        }

        test('resolve to a module ID once, when the filter is built', () => {
            define(5, [4])
            mLookups.set('revenge.props(open)', 4)

            const filter = withDependencies([entry('revenge.props(open)')])

            expect(lookupCalls).toEqual(['revenge.props(open)'])
            expect(filter(5)).toBe(true)
            expect(filter(5)).toBe(true)
            // Comparison is structural, so no further lookup can happen
            expect(lookupCalls).toHaveLength(1)
        })

        test('resolve inside nested maps', () => {
            define(5, [4])
            define(4, [9])
            mLookups.set('revenge.name(Inner)', 9)

            expect(withDependencies([[entry('revenge.name(Inner)')]])(5)).toBe(
                true,
            )
        })

        test('an unresolved entry can never match', () => {
            define(5, [4])

            const filter = withDependencies([entry('revenge.props(gone)')])

            expect(filter(5)).toBe(false)
            expect(logs.join('\n')).toContain('matched no module')
        })

        test('warn about the deprecation, reporting the resolved ID', () => {
            mLookups.set('revenge.props(open)', 4)
            withDependencies([entry('revenge.props(open)')])

            expect(logs.join('\n')).toContain(
                'Deprecated withDependencies filter entry at index 0',
            )
            expect(logs.join('\n')).toContain('to module 4')
        })
    })

    describe('keys', () => {
        test('ordered sets carry the o prefix', () => {
            expect(
                withDependencies(
                    ordered([
                        React,
                        JSXRuntime,
                        Dispatcher,
                        relative(1),
                        relative(2),
                        ImportTracker,
                    ]),
                ).key,
            ).toBe('revenge.deps(o[19,21,709,^1,^2,2])')
        })

        test('a range key differs from an exact pin key', () => {
            expect(
                withDependencies([
                    null,
                    null,
                    [ReactNative, ImportTracker],
                    relative(1),
                    relative.within(2, 3),
                    ImportTracker,
                ]).key,
            ).toBe('revenge.deps([,,[27,2],^1,^2..3,2])')

            expect(withDependencies([relative.within(2, 2)]).key).not.toBe(
                withDependencies([relative(2)]).key,
            )
        })

        test('every modifier is part of the key', () => {
            expect(withDependencies(partial([4])).key).toBe(
                'revenge.deps(p[4])',
            )
            expect(withDependencies(unordered([4])).key).toBe(
                'revenge.deps(u[4])',
            )
            expect(withDependencies(last([4])).key).toBe('revenge.deps(s*[4])')
            expect(withDependencies(skip(2, [4])).key).toBe(
                'revenge.deps(s2[4])',
            )
            expect(withDependencies(atLeast(3, [4])).key).toBe(
                'revenge.deps(p>3[4])',
            )
            expect(withDependencies([4]).key).toBe('revenge.deps([4])')
        })
    })

    describe('deprecated aliases', () => {
        test('point at their replacements', () => {
            expect(withDependencies.loose).toBe(withDependencies.partial)
            expect(withDependencies.includes).toBe(withDependencies.unordered)
        })
    })

    describe('developer warnings', () => {
        test('partial alongside last is a no-op', () => {
            withDependencies(partial(last([4])))
            expect(logs.join('\n')).toContain('partial() does nothing')
        })

        test('ordered alongside a window', () => {
            withDependencies(ordered(last([4])))
            expect(logs.join('\n')).toContain('ordered() ignores last()')

            logs.length = 0
            withDependencies(ordered(skip(2, [4])))
            expect(logs.join('\n')).toContain('ordered() ignores skip(2)')
        })

        test('ordered alongside unordered', () => {
            withDependencies(ordered(unordered([4])))
            expect(logs.join('\n')).toContain('ordered() and unordered()')
        })

        test('ordered floor feeds the count bounds', () => {
            withDependencies(atMost(2, ordered([4, 9, 2])))
            expect(logs.join('\n')).toContain('requires at least 3')
        })

        test('inverted and mixed sign ranges', () => {
            relative.within(3, 2)
            expect(logs.join('\n')).toContain('is inverted')

            logs.length = 0
            relative.within(-1, 2)
            expect(logs.join('\n')).toContain('mixes signs')
        })
    })
})
