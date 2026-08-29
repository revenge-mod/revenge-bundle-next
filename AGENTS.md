# Agent Instructions

Instructions for agents working in this repository. Read this before you touch anything.

## Load these skills first

Load both at the start of every session with the skill tool. Do not wait to be asked. If not found, ask the user to install them unless they tell you to skip.

- **`rtk`** for shell work. It proxies CLI commands and cuts up to 90% of their output.
  Run `rtk <command>` instead of the raw command, or let the hook rewrite it. Use `rtk proxy <cmd>` when you need unfiltered output for debugging. <https://github.com/rtk-ai/rtk>
- **`caveman`** for your own output. It cuts response tokens by about 65% and keeps technical accuracy. Default intensity is `full`. Keep it on for the whole session. <https://github.com/JuliusBrussee/caveman>

Compression never removes substance. Keep exact identifiers, commands, file paths, and `filepath:line` citations intact. Drop filler words, not facts.

## Project

Revenge Next builds the Revenge bundle, which is Hermes bytecode that runs inside the official Discord mobile app. The bundle is not standalone. A native bootstrapper loads it.

Sibling repositories user should specify the paths to:

| Repository                | Role                                                 |
| ------------------------- | ---------------------------------------------------- |
| `revenge-xposed`          | Native Xposed module.                                |
| `revenge-plugin-template` | Plugin template, index generator, release workflows. |
| `revenge-docs`            | User and plugin author documentation.                |

Changes that cross the native bridge usually need edits in `revenge-xposed` and `revenge-docs` in the same pass.

## Commands

```sh
deno install                         # install dependencies (CI uses --frozen)
deno run build                       # build the bundle to dist/revenge.bundle
deno run build --dev                 # build with debugging, slow, not for production
deno run dev                         # rebuild on change and serve the bundle on port 4040
deno x tsc --noEmit -p .             # typecheck
deno x biome check --write <paths>   # format and lint
deno run test                        # vitest, covers lib/patcher and scripts/plugins
```

The device fetches the bundle from port 4040 on reload. Without `deno run dev` running, it
keeps the last bundle it fetched, so a reload tests old code. Start the dev server before you
reload. Check its log for the served request to confirm the device picked up the new bundle.

**Never run `git stash`.** Staged files are reviewed work. A stash and pop cycle touches the index and can lose that state. Use a worktree or `git show HEAD:<path>` instead.

## Layout

- `lib/*` holds the `@revenge-mod/*` packages. Each has its own `package.json` with an `exports` map. Import through the package name, never through a relative path into another package.
- `src/plugins/{preinit,init,start}/` holds the bundled plugins. `src/plugins/*.ts` registers them with `import.meta.glob`, so a new directory with an `index.ts` needs no barrel edit.
- `shims/` holds module shims. `scripts/` holds the Deno build. `types/` holds ambient types.
- `plans/` holds design plans, named `YYYY-MM-DD-<name>-v<N>.md`. Write a plan before large or cross-cutting work, then execute it and tick the tasks.

## Writing style

These rules cover code comments, documentation, plans, commit text, and pull request text. They do not cover code, identifiers, or command syntax.

### Code style

Unless asked to refactor, do not change code style. Follow the existing style in the file you are editing. If you see a style violation, ask the user if they want it fixed. If there's a better way to write something, ask the user if they want it refactored before making changes. Do not refactor on your own.

### Comment rules

Comments are meant to be concise and easy to read. They are not a place to explain the obvious or to justify why the code exists. It should clarify intent and provide context that the code cannot express. Following the existing comment style is more important than following these rules. If a comment is already clear, do not change it unless asked.

These take priority over every other style rule below.

1. **High-density noun-phrasing**
   - Use sentence fragments over complete sentences for single-line comments.
   - Substitute leading articles ("a", "an", "the"), especially at the start of sentences, for plural nouns when possible.
   - Remove unnecessary relative pronouns ("whose", "which").
   - Prefer participial phrases over clause connectors. Write "with parsed manifest" instead of "whose manifest is parsed".
2. **Precision and directness**
   - Use exact technical jargon over explanatory descriptions. Write "cascading to its dependents"
     instead of "and so is everything that depends on it".
   - State state-facts directly. Do not explain a downstream consequence that context already
     makes obvious. Write "Installed optional dependencies that are unsatisfied" instead of
     "...so this plugin loaded without them".
3. **Verbs and actions**
   - Start multi-line docstring descriptions with a third-person singular verb: "Reads", "Parses", "Executes".
     Often times, you can subsitute longer words for shorter ones, such as "Run" for "Execute", as long as the meaning is preserved.
   - Use technical terms for actions: Write "Returns the parsed manifest" instead of "Responds with the manifest after parsing it".
   - Keep sentences under 15 words where possible. Do not add passive background filler.

### Prose rules, ASD-STE100 flavored

Apply these to longer prose. Use the strict form for error messages and step-by-step procedures.
Use the relaxed form for documentation and plans, where the vocabulary can stay natural.

- **Words.** One name for one thing.
  Short common words: start, use, help, make sure, before, after, about, get, show, also.
  Never: utilize, facilitate, ensure, prior to, subsequent to, regarding, obtain, demonstrate, additionally, furthermore, moreover.
- **No marketing adjectives.** Never: seamless, robust, powerful, cutting-edge, effortless, world-class, next-generation, revolutionary. American spelling.
- **Active voice.** "the parser reads the file", not "the file is read by the parser".
- **A verb for an action.** "analyze the log", not "perform an analysis of the log".
- **No stacked auxiliaries.** Write "this improves X", not "it is important to note that this may help to improve X".
- **Sentences.** One instruction per sentence. Max 20 words for an instruction, 25 for description. One topic per paragraph, max six sentences.
- **Steps.** Numbered vertical list, one action per item, imperative form. Put a condition before its command.

### Characters and tone

- No em dashes, arrows, or box-drawing characters anywhere in source or documentation. Use plain words and plain indentation.
- No semicolon chaining in a sentence. Write two sentences.
- Casual and clear beats professional-sounding. Say what the code does and why in plain words.
- Drop comments that state the obvious or that the code already says.
- Only add emoji when the user asks for it.

### Self-lint before you return text

1. Any sentence over 20 words? Split it.
2. Any semicolon or em dash? Replace it.
3. Any passive voice with a known actor? Make it active.
4. Any nominalization ("perform an analysis") or "-ing" main verb? Use a plain verb.
5. Same thing named two ways? Pick one name.
6. Any comment that adds nothing? Delete it.

## Traps

Each one cost real debugging time. Read them before you write code in that area.

### Bootstrap and plugins

- **React binds late.** `shims/react.ts` exports a binding that `waitForModules` fills asynchronously.
  Code that loads at preinit must not import `react`, and must not import any package that imports it, such as `zustand/react`.
  An early import captures `undefined` and fails far from the cause. Start-stage UI imports `@revenge-mod/plugins/_/react` for hooks.
  The `@revenge-mod/plugins/_` barrel must never re-export that entry.
- **`@revenge-mod/plugins/_` is a pure barrel** over `lib/plugins/src/_internal/*`, and about 39 files import it.
  Keep its exports exhaustive. Never import an `_internal` submodule from outside the package.
- **Plugin flags and status live in one store.** `lib/plugins/src/_internal/store.ts` is authoritative, and `meta.status` and `meta.flags` are accessors over it.
  Do not mirror plugin state in React state or in a second map.
- **Native plugin methods return values, not rejections.** Every `revenge.plugins.*` method resolves `{ result }` or `{ error: { code, message, stack?, details? } }`.
  Call them through `callPluginSystemMethod` in `lib/plugins/src/_internal/native.ts`. Using `callNativeMethod` and throwing in native loses the code and the message.

### Metro runtime

- **A failed factory poisons its module for the whole session.** `metroRequire` swallows the throw, sets `HasError`, clears `factory`, and replaces exports with `{}` (`lib/modules/src/metro/runtime.ts:61-86`).
  Later requires return that empty object, and the module can never re-initialize.
  `handleFactoryCall` also deletes the ID from `mUninitialized` without adding it to `mInitialized` (`lib/modules/src/metro/patches.ts:168-192`),
  so finders stop seeing it too. Discord's transpiled ESM dereferences imports at module scope, so every importer throws next. One early error cascades across the bundle and kills the app.
- **Never force an exports lookup at preinit.** At preinit use dependency fingerprints with `initialize: false`, or `waitForModules`.
  Initializing modules before the environment setup is done and module 0 is first required may throw errors like `ReferenceError: Property 'location' doesn't exist` and start the cascade above.
- **`mUninitialized` can change while you iterate it.** Copy the set before the loop, or re-check `mUninitialized.has(id)` per element.
  `runFilter` initializes a candidate to confirm a match, and `handleFactoryCall` then deletes every module it initialized.
  A live `Set` iteration silently skips those entries, so a lookup can miss a module that is sitting right there and matching.

### Module finders

- **Filters receive any value, including `undefined`.** `runFilter` does not screen exports.
  A predicate can get `null`, a primitive, a function, or a catch-all proxy, because CommonJS
  allows `module.exports = <value>`. Measured on a live client, 44% of initialized modules had a primitive or `null` namespace.
  Guard your own inputs. Call `isModuleExportBad` yourself when you want the old screening.
- **Never infer the pass from `exports === undefined`.** Read the fourth predicate argument, `initialized`, which is authoritative.
  `undefined` is a value a module can export, in both the namespace and the default position.
- **`FilterScopes.Uninitialized` claims three things at once.** It says sweep `mUninitialized`, the predicate can decide with no exports, and a cached hit may initialize on demand.
  `withStoreName` only wants the third (`lib/discord/src/flux/stores.ts:125-133`). Composites read the same bit to pick a prefilter.
  A false claim turns a one-module lookup into a full sweep with a predicate that can never match.
- **Module ID constants bind late.** `ImportTrackerModuleId` is a `let` that `getModules` fills asynchronously (`lib/discord/src/patches/import-tracker.ts:14-17`).
  A filter array literal built at import time captures `undefined`, and an `undefined` entry degrades to a wildcard. Build the map inside the lookup callback.
  Watch for the dev warning `Bad withDependencies filter, undefined ID at index N`.
- **Check `filter.key` before you claim two filters collide.** `keyFor` receives the args array, not the dependency map, so a top-level map is already keyed as a nested element.
  Bump `ExpectedCacheVersion` in `lib/modules/src/caches.ts` only when key syntax collides. A bump drops every cached key and the blacklist, which costs one slow launch.

### Plugin API surface

- **The unscoped API is assembled across packages.** `lib/plugins/src/types.ts` declares six properties.
  `utils`, `jsonStorage` and `components` arrive later through `declare module '@revenge-mod/plugins/types'` blocks that live in other libraries (`lib/{utils,jsonStorage,components}/src/types.ts`).
  One file gives you a wrong picture of the API. Grep for the augmentation before you claim the API has some shape.
- **`revenge` is not a global.** External plugins get it as a function parameter (`lib/plugins/src/_internal/external-plugins.ts:246-250`).
  The ambient `const revenge` in `types/globals.consumers.ts:22-25` exists for types only. `globalThis.revenge` is undefined.
- **Module path does not map to global path.** `@revenge-mod/externals/browserify` is `revenge.externals.Browserify`. `@revenge-mod/modules/metro/utils` and
  `.../metro/subscriptions` both land on `revenge.modules.metro` (`lib/plugins/src/apis/modules.ts:21-24`).
  `@revenge-mod/components/Page` maps to the module's default export, not its namespace (`lib/components/src/types.ts:2-5`). Never derive one side from the other with string rules.
- **Hidden modules stay out of `modules.json`.** That file is the bundler contract for names resolvable on `revenge`.
  Hidden types listed there would typecheck and then fail at plugin bundle time. `partitionEntries` in `scripts/types.ts:497` keeps them in `modules.hidden.json`.

### DevTools MCP

Use it to check a claim against the running client. Every item below cost a wasted round trip.

- **MCP runs in the scope of a plugin.** It has access to `revenge` global. It can also access private internals via the hidden API using `revenge.hidden`.
  If that is undefined, ask the user to enable Developer Mode in Settings > Revenge.
- **Patch the module exports, never the fiber's `type`.** React captured the function reference at mount, so replacing a property on some object you hold changes nothing.
  Discord's transpiled JSX reads `exports.Foo` at render time, so patching `revenge.modules.metro.getInitializedModuleExports(id).Foo` does take effect on the next render.
  A fiber mounted before you unpatched keeps the old wrapper, so `fiber.type !== exports.Foo` is expected and is not a sign you found the wrong module.
- **`revenge.modules.metro` has no `require`.** It exposes `getInitializedModuleExports`, `getModuleDependencies`, `isModuleInitialized`, `isModuleExportBad` and the subscription helpers.
  Use the `require_module` tool when the module may still be uninitialized.
- **`eval` truncates nested values.** Anything past shallow depth prints as `[Array(20)]` or
  `[Object {a, b}]`, which hides the data you asked for. Return a JSON string or a joined string instead of the object.
- **Hermes strips function source.** `toString` returns no body, so you cannot read a component at runtime. Read the disassembly repos for the shape, then confirm the behavior on device.
- **`fn.length` stops at the first default parameter.** A three parameter function with two defaults reports `1`, and a destructured props object reports `1` as well. It bounds the signature, it does not give it.
- **A stored fiber goes stale on the next render.** React double buffers through `alternate`, so the node you saved points at the previous tree. Re-run the match after every forced render.
- **Nothing forces a re-render for you.** Walk `fiber.memoizedState` to a `useState` hook and call `hook.queue.dispatch`. React bails out on an equal value, so dispatch a different one and restore it after. Save the original first.
- **Unpatch and restore before you finish.** Patches and mutated state live on the device across evals. A leaked patch makes the next reading wrong and the wrongness looks like a real finding.
- **`type.name` is missing for many fibers.** Context providers and memo wrappers stringify as `[object Object]`. Match on the fiber `tag` and on prop keys instead.
- **Props on a live fiber only show what the caller passed.** An absent optional prop proves nothing about the component. To test one, inject it with a `before` hook and force a render.
- **Look in the Design barrel before you hunt module IDs.** `lib/discord/src/design.ts` already exports most components, and the barrel is stable across app versions. Module IDs are not.

### Build scripts and tooling

- **`import defer` rewriting runs after the JSX transform.** `hermesSwcPlugin()` precedes `importDefer()` (`scripts/build.ts:122-123`), so the plugin only ever sees compiled output.
  JSX is already `_jsx(Alerts.RecoveryModal, {})` and types are gone. `<ns().Foo />` is not valid JSX, so the plugin throws when a deferred namespace appears in a JSX element name.
  Keep that order. A harness that feeds the plugin raw TSX tests a case the build never produces.
- **Don't use regex for static analysis.** Use `rolldown/parseAst` like `scripts/plugins/import-defer.ts`. Regexes are brittle and causes edge cases.
- **TypeScript is version 7, the native port** (`package.json:23`). Its main export is the version string. There is no `ts.createProgram`, no `ts.factory`, no `TypeChecker`.
  A checker sits behind `typescript/unstable/sync`, which is explicitly unstable. If possible, avoid codegen that requires the typechecker. If you must, install a separately named TypeScript 5.x.
- **Line endings are CRLF.** `.editorconfig` sets it and biome honors it through `useEditorconfig`. Write LF if it uses the least amount of tokens.
  Then format with `biome check --write`. A new file written with LF fails `biome check` with every line marked changed. That reads like a formatting disaster and is only line endings.
- **Check a biome failure against `HEAD` before you fix it.** Some files already fail there. Fixing them mixes unrelated churn into your diff.

## The AI notice file

Unless definitely instructed otherwise by the user, you must always create and stage an empty `AI_NOTICE` file in the `assets` folder if it does not exist. It is a requirement for any PR that touches code generated by an AI. Its presence signals to the user that they must review the AI-generated code before merging. The file can be removed if the user uses AI responsibly: manually reviewing the code, removing the file, therefore being responsible for the generated content.

## Before you finish

1. `deno run build` passes.
2. `deno x biome check --write` to lint, format, and fix things safely. Output must be clean on every file you touched.
3. The typecheck diff against `HEAD` shows zero new errors.
4. `deno run test` passes.
5. Do not create documentation files unless the user asks for them.
