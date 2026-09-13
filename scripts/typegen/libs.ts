import chalk from 'chalk'
import { join } from 'path'
import assets from '../../lib/assets/package.json' with { type: 'json' }
import components from '../../lib/components/package.json' with { type: 'json' }
import discord from '../../lib/discord/package.json' with { type: 'json' }
import externals from '../../lib/externals/package.json' with { type: 'json' }
import hidden from '../../lib/hidden/package.json' with { type: 'json' }
import jsonStorage from '../../lib/json-storage/package.json' with {
    type: 'json',
}
import modules from '../../lib/modules/package.json' with { type: 'json' }
import patcher from '../../lib/patcher/package.json' with { type: 'json' }
import plugins from '../../lib/plugins/package.json' with { type: 'json' }
import react from '../../lib/react/package.json' with { type: 'json' }
import utils from '../../lib/utils/package.json' with { type: 'json' }
import {
    mergeModule,
    nameModule,
    normalizeBinding,
    sourcePathOf,
} from './generator'
import { HiddenApi, NoGlobal, Paths, PublicApi } from './shared'
import type {
    ApiRoot,
    ExportBinding,
    LibraryModule,
    MergeSource,
    TrimLeadingDot,
} from './shared'

/** Declares every generated module and its property path on an API root. */
export function getLibraries(): LibraryModule[] {
    return [
        library(assets, [
            ['', 'assets'],
            ['types', NoGlobal],
        ]),
        library(
            components,
            [
                ['', 'components'],
                ['FormSwitch', 'components.FormSwitch', 'default'],
                ['Page', 'components.Page', 'default'],
                ['SearchInput', 'components.SearchInput', 'default'],
                [
                    'TableRowAssetIcon',
                    'components.TableRowAssetIcon',
                    'default',
                ],
                ['types', NoGlobal],
            ],
            [['_', 'components']],
        ),
        library(
            discord,
            [
                ['actions', 'discord.actions'],
                [
                    'common/app-start-performance',
                    'discord.common.appStartPerformance',
                ],
                ['common/constants', 'discord.common.constants'],
                ['common/flux', 'discord.common.flux'],
                ['common/import-tracker', 'discord.common.importTracker'],
                ['common/logger', 'discord.common.logger'],
                ['common/tokens', 'discord.common.tokens'],
                ['common/utils', 'discord.common.utils'],
                ['design', 'discord.design'],
                ['flux', 'discord.flux'],
                ['modules/main_tabs_v2', 'discord.modules.mainTabsV2'],
                ['modules/settings', 'discord.modules.settings'],
                [
                    'modules/settings/renderer',
                    'discord.modules.settings.renderer',
                ],
                ['native', 'discord.native'],
                ['types', NoGlobal],
                ['utils/modules/finders', 'discord.utils.modules.finders'],
                [
                    'utils/modules/metro/subscriptions',
                    'discord.utils.modules.metro.subscriptions',
                ],
            ],
            [['_/modules/settings', 'discord.settings']],
        ),
        library(externals, [
            ['browserify', 'externals.Browserify'],
            ['react-native-clipboard', 'externals.ReactNativeClipboard'],
            [
                'react-native-safe-area-context',
                'externals.ReactNativeSafeAreaContext',
            ],
            ['react-navigation', 'externals.ReactNavigation'],
            ['shopify', 'externals.Shopify'],
        ]),
        library(modules, [
            ['finders', 'modules.finders'],
            ['finders/filters', 'modules.finders.filters'],
            {
                from: 'metro/subscriptions',
                into: 'metro',
                global: 'modules.metro',
            },
            { from: 'metro/utils', into: 'metro', global: 'modules.metro' },
            ['native', 'modules.native'],
            ['native/app', 'modules.native.app'],
            ['native/fs', 'modules.native.fs'],
            ['types', NoGlobal],
        ]),
        library(patcher, [
            ['', 'patcher'],
            ['types', NoGlobal],
        ]),
        library(
            plugins,
            [
                ['constants', 'plugins.constants'],
                ['types', NoGlobal],
                ['utils', 'plugins.utils'],
            ],
            [
                ['_', 'plugins.internal'],
                ['_/repositories', 'plugins.repositories'],
            ],
        ),
        library(react, [
            ['', 'react'],
            ['jsx-runtime', 'react.jsxRuntime'],
            ['native', 'react.native'],
            ['types', NoGlobal],
        ]),
        library(jsonStorage, [
            ['', 'jsonStorage'],
            ['types', NoGlobal],
        ]),
        library(utils, [
            ['callback', 'utils.callback'],
            ['discord', 'utils.discord'],
            ['error', 'utils.error'],
            ['object', 'utils.object'],
            ['promise', 'utils.promise'],
            ['proxy', 'utils.proxy'],
            ['react', 'utils.react'],
            ['tree', 'utils.tree'],
            ['types', NoGlobal],
        ]),
        // Defines the hidden root rather than hanging off it
        library(
            hidden,
            [],
            [
                ['', NoGlobal],
                ['types', NoGlobal],
            ],
        ),
    ].flat()
}

/**
 * Converts library exports into generated modules.
 *
 * @param exports Public exports mapped under `revenge`.
 * @param internal Internal exports mapped under `revenge.hidden`.
 */
function library<
    E extends Record<`.${string}`, { default?: string; types?: string }>,
>(
    pkg: { name: string; exports: E },
    exports: ExportBinding<TrimLeadingDot<Extract<keyof E, string>>>[],
    internal: ExportBinding<TrimLeadingDot<Extract<keyof E, string>>>[] = [],
): LibraryModule[] {
    return [
        ...libraryModule(pkg, exports, PublicApi),
        ...libraryModule(pkg, internal, HiddenApi),
    ]
}

/** Generates modules of one tier, collapsing merged exports into one module. */
function libraryModule(
    pkg: { name: string; exports: Record<string, unknown> },
    exports: ExportBinding<string>[],
    root: ApiRoot,
): LibraryModule[] {
    const libName = pkg.name.split('/').at(-1)!
    const generated: LibraryModule[] = []
    const merges = new Map<string, MergeSource[]>()

    for (const item of exports) {
        const binding = normalizeBinding(item)
        const source = sourcePathOf(pkg, binding.name)
        if (!source) continue

        const path = join(Paths.lib, libName, source)

        if (binding.into) {
            const group = merges.get(binding.into)
            const merging = { name: binding.name, path, global: binding.global }

            if (group) group.push(merging)
            else merges.set(binding.into, [merging])

            continue
        }

        const names = nameModule(libName, binding.name)

        console.debug(chalk.gray(`📄 ${names.name} -> ${names.specifier}`))

        generated.push({
            ...names,
            path,
            root,
            global: binding.global,
            interop: binding.interop,
        })
    }

    for (const [into, sources] of merges)
        generated.push(mergeModule(pkg.name, libName, into, sources, root))

    return generated
}
