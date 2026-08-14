# ProseMirror Devtools

Compact runtime inspection for ProseMirror, with multi-editor switching, transaction history,
plugin timing, snapshots, and a panel that plugs into TanStack Devtools.

> This is development tooling. Instrumentation adds a small amount of overhead, so keep it out of
> production unless you intentionally need runtime diagnostics there.

## What is included

- A store that tracks multiple `EditorView` instances and lets the panel switch between them at
  runtime.
- Safe plugin wrappers that time state fields, transaction hooks, editor props, plugin views, and
  node views.
- One performance bar per dispatched root transaction, recalculated after every dispatch.
- Application-defined markers for collaboration, commands, and other domain-specific work.
- State, selection, document, transaction, plugin, and schema inspectors.
- Local snapshots that can be saved, restored, imported, and exported as JSON.
- A compact React panel with system, light, and dark themes plus compact/comfortable density.
- A TanStack Devtools adapter and a private Vite playground with a live editor.

## Repository architecture

| Path                                                                                                     | Purpose                                                                                   |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`packages/prosemirror-devtools`](./packages/prosemirror-devtools)                                       | Published library, framework-neutral runtime, React panel, and TanStack adapter           |
| [`packages/prosemirror-devtools/src/core/store`](./packages/prosemirror-devtools/src/core/store)         | Functional store, transaction records, timing aggregates, and browser performance entries |
| [`packages/prosemirror-devtools/src/core/dispatch`](./packages/prosemirror-devtools/src/core/dispatch)   | Default and custom dispatch observation                                                   |
| [`packages/prosemirror-devtools/src/panel/features`](./packages/prosemirror-devtools/src/panel/features) | Feature-owned React views and models                                                      |
| [`packages/tanstack-devtools-demo`](./packages/tanstack-devtools-demo)                                   | Private Vite playground with a registered editor and optional artificial plugin latency   |
| [`.changeset`](./.changeset)                                                                             | Version and release notes for the public package                                          |

The runtime flow is deliberately explicit:

```text
raw plugins → instrument plugins → EditorState.create → new EditorView → attach view
                                                              ↓
                                        store → React panel / TanStack Devtools
```

Plugin instrumentation must happen before `EditorState.create`. Attaching happens after the
`EditorView` exists. Use the same instance id for both steps so hook timings and transactions land
in the same store entry.

## Requirements

- Node.js `^22.13.0` or `>=24.0.0`
- pnpm 11

## Run the workspace

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the TanStack Devtools demo. Edit the playground document and open the launcher in
the lower-right corner. The **slow apply** switch adds artificial plugin latency so the bar chart
and hook aggregates are easy to inspect.

## Library quick start

Install the library in an application that already uses ProseMirror:

```sh
pnpm add -D prosemirror-devtools
```

Instrument the plugins before creating the state, then attach the finished view:

```ts
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { attachProseMirrorDevtools, instrumentProseMirrorPlugins } from "prosemirror-devtools/core";

const instanceId = "article-editor";
const rawPlugins = [new Plugin({})];

const plugins = instrumentProseMirrorPlugins(rawPlugins, {
  instanceId,
});

const state = EditorState.create({
  schema,
  plugins,
});

const view = new EditorView(document.querySelector("#editor")!, {
  state,
});

const attachment = attachProseMirrorDevtools({
  id: instanceId,
  label: "Article editor",
  view,
});

// On teardown:
attachment.detach();
view.destroy();
```

Do not put the original and instrumented versions of a plugin in the same state. The wrappers keep
runtime plugin keys stable, but they are replacement `Plugin` objects, so strict object identity is
not preserved.

### Tiptap

The Tiptap entrypoint encapsulates the required lifecycle integration without importing Tiptap from
the library:

```ts
import { Extension } from "@tiptap/core";
import {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
} from "prosemirror-devtools/tiptap";

const TiptapDevtools = Extension.create({
  name: "prosemirrorDevtools",
  priority: 10_000,
  onBeforeCreate() {
    setupTiptapDevtools(this.editor, { id: "main", label: "Main editor" });
  },
  onCreate() {
    attachTiptapDevtools(this.editor);
  },
  dispatchTransaction(props) {
    dispatchTiptapTransaction(this.editor, props);
  },
  onDestroy() {
    detachTiptapDevtools(this.editor);
  },
});
```

Add that extension to the editor's `extensions` array. The application controls all Tiptap-specific
extension fields; the helpers instrument generated ProseMirror plugins, register the view, record
through Tiptap 3's native transaction middleware, and clean up. The adapter does not import Tiptap
or replace the view's dispatcher. Keep the high priority so the middleware surrounds ordinary
lower-priority extensions, and do not call `props.next` separately—the helper forwards it. See the
[package guide](./packages/prosemirror-devtools/README.md#tiptap-integration) for options and
limitations.

## TanStack Devtools

The optional adapter creates a plugin that inherits the TanStack shell theme:

```tsx
import { TanStackDevtools } from "@tanstack/react-devtools";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/tanstack";

const prosemirrorPlugin = createProseMirrorDevtoolsPlugin({
  defaultOpen: false,
  performanceFrameBudgetMs: 1000 / 60,
});

export function App() {
  return <TanStackDevtools plugins={[prosemirrorPlugin]} />;
}
```

The root export also provides `ProseMirrorDevtoolsPanel` for mounting the panel in any React host.
See the [package guide](./packages/prosemirror-devtools/README.md) for isolated stores and panel
options.

## Multiple editor instances

The default `prosemirrorDevtoolsStore` is shared. Give each editor a unique id and pass that id
to both `instrumentProseMirrorPlugins` and `attachProseMirrorDevtools`. Instances appear and
disappear as views attach and detach, and the active editor can be changed without remounting the
panel.

For isolation, call `createProseMirrorDevtoolsStore()` and pass the result to instrumentation,
attachment, and the panel/TanStack adapter. A store entry keeps 10,000 transaction records by
default; set `transactionLimit` while attaching to change that bound.

## Panel capabilities

| Tab         | What it shows                                                                                                                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| State       | Expandable document tree, positions, selected node JSON, selection, marks, and document statistics                                                                                                                                                                                      |
| History     | Recent root dispatches, appended transactions, steps, metadata, before/after documents, and document restore                                                                                                                                                                            |
| Performance | Interactive TanStack Charts dispatch timeline with a configurable frame-budget reference and adaptive low-duration detail zone, previous/next navigation, slowest-first plugin ranking, compact timing summary, transaction/step payloads, document changes, and cumulative hook timing |
| Plugins     | Searchable plugin list, plugin state, ordering, and exposed editor props                                                                                                                                                                                                                |
| Schema      | Node and mark specs plus the top node type                                                                                                                                                                                                                                              |
| Snapshots   | Per-instance local save, restore, import, export, and delete controls                                                                                                                                                                                                                   |

The toolbar also provides live instance switching, system/light/dark color modes, and two density
levels.

## Understanding the performance data

With ProseMirror's default dispatcher, one record covers the synchronous call from dispatch entry
through `EditorState.applyTransaction` and `EditorView.updateState`:

- **Total dispatch** is the inclusive synchronous duration.
- **State apply** includes filtering, state-field application, and accepted appended transactions.
- **View update** covers synchronous ProseMirror DOM reconciliation and plugin-view updates.
- **Plugin cost** groups every wrapped hook by plugin, shows the time for each hook, and orders
  plugins by their full synchronous cost for the selected dispatch. The profiler-style bar ranking
  is the primary view; exact hook and call data stays available in the disclosure below it.
- **Applied** and **appended** counts are distinct from the root dispatch count.

By default, each retained dispatch also creates a User Timing measure named
`prosemirror-devtools:<instance>:dispatch:<number>`. Set `performanceMarks: false` when attaching if
you do not want those measures.

Set `performanceExtension: true` to opt into Chrome DevTools Performance custom tracks. A recording
then nests the full dispatch, exact State apply/View update phases, and individual plugin hooks on a
single **Dispatches** track. Application markers use a separate **Markers** track. Custom
dispatchers are identified by properties on the outer dispatch entry instead of a duplicate track.
Chrome requires **Capture settings → Show custom tracks** to be enabled.

These numbers do not measure browser paint, compositing, input work that happens before dispatch,
or asynchronous framework commits. They describe synchronous ProseMirror work, not a complete
frame time.

Plugin `view.update` callbacks run synchronously inside `EditorView.updateState`, so their measured
time is part of both the editor's view-update phase and that plugin's full synchronous cost. Full
plugin cost is the union of its observed hook intervals; nested spans within that plugin are counted
once. Plugin rows remain inclusive and can overlap one another, so they are not additive.

Synchronous style or layout forced while these calls run is included. Browser paint, compositing,
and work scheduled after the synchronous dispatch returns are not.

If an `EditorView` already has a custom `dispatchTransaction`, the attachment preserves and calls
it with the original `this` value. While that synchronous callback runs, the devtools observes its
public `EditorState.apply`/`applyTransaction` and `EditorView.updateState`/`update` calls. This
provides the same phase split and filtered/appended transaction details for conventional custom
dispatchers without applying anything twice. A dispatcher that defers work, invokes previously
bound methods, or manages state outside the current view may still leave a phase unavailable; work
performed after the callback returns is outside the recorded duration. Applied/appended counts are
reported only when the exact dispatched transaction result is successfully installed as the final
view state.

History records serialize complete before/after documents, selections, steps, metadata, and changed
ranges. Keep the transaction limit proportionate to document size. Direct calls to
`view.updateState`, or replacing `dispatchTransaction` after attachment, bypass the dispatch
wrapper.

## Snapshots

Snapshots contain serialized document and selection JSON. The panel stores them in `localStorage`
under the active instance id; they are not uploaded anywhere. Restoring dispatches a normal
transaction through the current editor, so the saved document must be compatible with its schema.
A stale saved selection is ignored rather than preventing a valid document restore.

## Workspace commands

| Command             | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `pnpm dev`          | Start the private TanStack demo                          |
| `pnpm build`        | Build all workspace packages in dependency order         |
| `pnpm test`         | Run package test suites                                  |
| `pnpm typecheck`    | Type-check every package                                 |
| `pnpm lint`         | Lint the complete workspace                              |
| `pnpm format:check` | Verify Prettier formatting                               |
| `pnpm check`        | Run formatting, linting, build, type-checking, and tests |
| `pnpm changeset`    | Add a release note and semantic version intent           |

The Changesets release workflow versions and publishes `prosemirror-devtools`; the demo remains
private.

## License

[MIT](./LICENSE)
