# prosemirror-devtools

Runtime observability for ProseMirror: inspect editor state, switch between live instances, retain
transaction history, and find slow plugin hooks from a compact React panel or inside TanStack
Devtools.

> Use this as development tooling. Wrapping hooks and recording serialized history adds overhead.

## Install

```sh
pnpm add -D prosemirror-devtools
```

The package expects ProseMirror, React 19 or newer, and—only when using the adapter—
`@tanstack/react-devtools` in the host application.

## Quick start

The setup order is important:

1. Create the raw plugins.
2. Instrument them before `EditorState.create`.
3. Create the `EditorState` and `EditorView`.
4. Attach the completed view.
5. Detach before destroying the view.

```ts
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { attachProseMirrorDevtools, instrumentProseMirrorPlugins } from "prosemirror-devtools/core";

const instanceId = "main-editor";
const rawPlugins = [new Plugin({})];

const plugins = instrumentProseMirrorPlugins(rawPlugins, {
  instanceId,
  getPluginLabel(plugin, index) {
    return `Plugin ${index + 1}`;
  },
});

const state = EditorState.create({ schema, plugins });
const view = new EditorView(document.querySelector("#editor")!, { state });

const devtools = attachProseMirrorDevtools({
  id: instanceId,
  label: "Main editor",
  view,
  transactionLimit: 150,
  performanceMarks: true,
  performanceExtension: true,
});

// On teardown:
devtools.detach();
view.destroy();
```

Use the same `instanceId`/`id` for instrumentation and attachment. Hook measurements are routed by
that id. Never include both a raw plugin and its wrapped replacement in the same state.

## Tiptap integration

Use the dedicated Tiptap 3 entrypoint to avoid patching `extensionManager.plugins` or replacing the
view's dispatcher in application code. The entrypoint does not import `@tiptap/core` or create an
extension; the application owns the extension name, priority, and lifecycle configuration:

```ts
import { Extension } from "@tiptap/core";
import {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
} from "prosemirror-devtools/tiptap";

const devtoolsOptions = {
  id: "main",
  label: "Main editor",
  performanceExtension: true,
} as const;

export const TiptapDevtools = Extension.create({
  name: "prosemirrorDevtools",
  priority: 10_000,
  onBeforeCreate() {
    setupTiptapDevtools(this.editor, devtoolsOptions);
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

Add `TiptapDevtools` to the editor's `extensions` array. `setupTiptapDevtools` intercepts Tiptap's
ProseMirror plugin generation and instruments the result before Tiptap installs it. As soon as the
real `EditorView` exists, the integration registers it. `attachTiptapDevtools` is an idempotent
`onCreate` fallback, while `detachTiptapDevtools` restores the plugin getter, unregisters the view,
and is safe to call repeatedly.

`dispatchTiptapTransaction` uses Tiptap's native
[`dispatchTransaction` extension middleware](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension#dispatchtransaction).
It measures around `next(transaction)` and calls it exactly once, so Tiptap's transaction events,
lower-priority extension middleware, and a custom `editorProps.dispatchTransaction` remain in the
chain. Do not also call `props.next` in the extension hook, and do not attach the same view through
`attachProseMirrorDevtools`; either would dispatch or record the transaction twice.

Tiptap runs higher-priority transaction middleware earlier. A high priority such as `10_000` makes
the devtools surround ordinary lower-priority middleware; any extension with a higher priority runs
outside the measurement. Keep Tiptap's `enableExtensionDispatchTransaction` option enabled (its
default), otherwise the hook is not called. Tiptap 2 does not expose this middleware hook; use the
generic `prosemirror-devtools/core` integration for Tiptap 2.

Use `instrumentPlugins: false` when only transaction history and dispatch phases are needed; this
also avoids intercepting Tiptap's plugin getter.

The adapter instruments the initial plugin set generated while the editor view is created. Plugins
registered dynamically later with `editor.registerPlugin` are not automatically replaced.

### What plugin wrapping measures

`instrumentProseMirrorPlugins` creates semantically equivalent replacement plugins and measures:

- `state.init` and `state.apply`
- `filterTransaction` and `appendTransaction`
- function-valued editor props, including individual `handleDOMEvents` handlers
- node-view creation plus `update`, selection, mutation, event, and destroy methods
- plugin-view creation, update, and destroy

The panel presents `props.decorations` as **Decoration change**. That timing covers the plugin callback
that produces a `DecorationSet`; later decoration mapping and DOM reconciliation cannot be
attributed to that callback safely and remain part of the surrounding view-update duration.

Return values and thrown errors are preserved. Wrappers are cached for the same original plugin,
instance id, and store. Runtime plugin keys are kept stable so plugin state lookup continues to
work, including for plugins without an explicit `PluginKey`.

The wrapper is still a different `Plugin` object. Code that compares a plugin with strict object
identity can observe that difference; prefer `PluginKey` lookups for integrations that need stable
identity.

## Registering multiple editors

The exported `prosemirrorDevtoolsStore` is a shared singleton. Attach any number of editors with
unique ids, and the panel's selector can switch the active instance at runtime.

```ts
import {
  attachProseMirrorDevtools,
  instrumentProseMirrorPlugins,
  prosemirrorDevtoolsStore,
} from "prosemirror-devtools/core";

const id = "review-editor";
const plugins = instrumentProseMirrorPlugins(rawPlugins, {
  instanceId: id,
  store: prosemirrorDevtoolsStore,
});

const state = EditorState.create({ schema, plugins });
const view = new EditorView(mount, { state });

const attachment = attachProseMirrorDevtools({
  id,
  label: "Review notes",
  view,
  store: prosemirrorDevtoolsStore,
});
```

An id may identify only one live `EditorView`; registering a different view under the same id
throws. Detaching removes the instance and automatically selects another registered editor when
the active one disappears. Attaching the same view under the same id again returns the existing
attachment.

### Isolated stores

Create a store when separate panels, tests, or application roots must not share editor state:

```tsx
import { ProseMirrorDevtoolsPanel } from "prosemirror-devtools";
import { createProseMirrorDevtoolsStore } from "prosemirror-devtools/core";

const store = createProseMirrorDevtoolsStore();

// Pass `store` to instrumentProseMirrorPlugins and attachProseMirrorDevtools too.
export function EditorDiagnostics() {
  return <ProseMirrorDevtoolsPanel store={store} defaultTab="performance" />;
}
```

For custom hosts, `subscribe` and `getSnapshot` expose the complete state. Narrow consumers can use
the matching active-instance, descriptor-list, and per-instance reader/subscription pairs so an
update in one editor does not rerender unrelated UI. Store actions include registration, active
instance selection, transaction clearing, recording, plugin timing, and custom markers.

## Custom performance markers

Applications can annotate the currently active dispatch with domain-specific point events or
synchronous spans. This is useful for collaboration rebases, schema migrations, command pipelines,
or any work whose meaning the generic ProseMirror instrumentation cannot infer.

```ts
import { markProseMirrorDevtools, measureProseMirrorDevtools } from "prosemirror-devtools/core";

markProseMirrorDevtools(instanceId, "Remote steps received", {
  category: "collaboration",
  tone: "info",
  data: { count: steps.length, version },
});

const rebased = measureProseMirrorDevtools(
  instanceId,
  "Collaboration rebase",
  () => rebaseSteps(steps),
  {
    category: "collaboration",
    tone: "warning",
    data: { fromVersion, toVersion },
  },
);
```

`markProseMirrorDevtools` returns `false` when no dispatch is active. The measured callback always
runs; outside an active dispatch its result or error is simply passed through without recording a
marker. Marker data is safely serialized before it reaches the panel. Pass `store` in the
options when using an isolated store.

## TanStack Devtools integration

Install the optional peer if it is not already in the application:

```sh
pnpm add -D @tanstack/react-devtools
```

Create one stable plugin object and pass it to the TanStack shell:

```tsx
import { TanStackDevtools } from "@tanstack/react-devtools";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/tanstack";

const prosemirrorPlugin = createProseMirrorDevtoolsPlugin({
  id: "prosemirror-devtools",
  name: "ProseMirror",
  defaultOpen: false,
  // store, // optional; defaults to the shared singleton
});

export function App() {
  return <TanStackDevtools plugins={[prosemirrorPlugin]} />;
}
```

The adapter follows the shell's light/dark theme. It also re-exports
`ProseMirrorDevtoolsPanel` and its prop types for adapter-specific imports.

## Standalone React panel

```tsx
import { ProseMirrorDevtoolsPanel } from "prosemirror-devtools";

export function Diagnostics() {
  return (
    <ProseMirrorDevtoolsPanel
      defaultTab="state"
      theme="system"
      className="my-devtools"
      style={{ height: 520 }}
    />
  );
}
```

`theme` accepts `"system"`, `"light"`, or `"dark"`. The panel injects its own scoped styles when
mounted and provides an in-panel theme cycle plus compact/comfortable density control. Pass a
`styleTarget` document when rendering into a popup or picture-in-picture document; the TanStack
adapter does this automatically.

## Panel reference

### State

- Expandable document tree with node names, text previews, marks, sizes, and positions.
- Selected-node JSON, complete document JSON, selection, stored marks, and active marks.
- Document node, child, and text statistics.
- Double-click a document node to scroll its DOM representation into view.

### History

- One record per root dispatch, with badges for document, selection, appended, filtered, and error
  outcomes.
- Root plus appended transaction summaries, steps, metadata, and before/after serialized
  documents.
- State-apply, view-update, total, applied-transaction, and step counts.
- Restore the document and selection from a retained record.

### Performance

- An interactive TanStack Charts stacked bar for each of the latest 60 retained dispatches,
  updated after every dispatch and selectable by pointer or keyboard.
- Apply, view-update, or inclusive custom-dispatch phase segments.
- A compact status strip for average, p95, maximum, dispatch count, and retained-record count.
- One selected-dispatch inspector shared with History: plugin cost remains visible beside
  root/appended transaction steps and metadata, with selection and before/after documents in the
  detail pane.
- A profiler-style TanStack Charts ranking of full synchronous cost per plugin, ordered slowest
  first for the selected dispatch, with exact hook/call rows in a compact disclosure.
- Application-defined point markers and measured spans, including optional structured context.
- A collapsible cumulative-hook table since the last clear, with call count, average, maximum, and
  total time.

### Plugins and schema

- Search plugins by runtime key and inspect order, state, and editor props.
- Inspect schema node specs, mark specs, and the top node type.

### Snapshots

- Save the current document and selection under the active instance.
- Restore, delete, import, and export JSON snapshots.
- Persist snapshots per instance in `localStorage`.

## Performance semantics

All durations use the monotonic `performance.now()` clock when available.

| Field                    | Meaning                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `totalDuration`          | Inclusive synchronous editor dispatch work, stopped before devtools serializes and publishes the resulting record         |
| `applyDuration`          | Default-dispatch time spent in `EditorState.applyTransaction`, including filtering and appended transactions              |
| `viewUpdateDuration`     | Default-dispatch time spent in `EditorView.updateState`, including synchronous DOM reconciliation and plugin-view updates |
| `customDispatchDuration` | Inclusive time spent in an existing custom `dispatchTransaction` function                                                 |
| `timings`                | Wrapped plugin hook calls that occurred while the dispatch measurement was active                                         |
| `pluginTimings`          | Per-instance aggregate count, total, average, maximum, and last duration by plugin and hook                               |

For the selected dispatch, the panel groups `timings` by plugin and hook. A plugin's **full sync**
cost is the duration covered by the union of all its hook intervals. This includes synchronous
`view.update` callbacks and avoids counting that plugin's nested or overlapping callbacks twice.
Different plugin rows remain inclusive and can overlap, so they must not be added together. Full
sync is observed plugin callback time, not the entire editor render phase.

The same UI-independent calculation is available from the performance feature entrypoint:

```ts
import { groupPluginTimings } from "prosemirror-devtools/performance";

const groups = groupPluginTimings(transactionRecord.timings);
```

The entrypoint also exports `PluginTiming`, `PluginHook`, `PluginTimingGroup`, and
`PluginHookTimingGroup` as TypeScript types. It does not import React or the panel's chart
dependencies, so it can be used by custom reporters and non-React integrations.

One root call to `view.dispatch` produces one `TransactionRecord`. Its
`appliedTransactionCount` includes accepted appended transactions, while
`appendedTransactionCount` excludes the root. A rejected root transaction has zero applied
transactions and is marked as filtered.

The default retention limit is 100 records and is configurable through `transactionLimit`.
Headline average/p95/max values use retained records, and the chart displays the last 60. Plugin
hook aggregates cover calls since attachment or the last `clearTransactions` call, including calls
older than the retained transaction window.

### User Timing measures

`performanceMarks` defaults to `true`. Each retained dispatch creates a browser User Timing measure
with this shape:

```text
prosemirror-devtools:<sanitized-instance-id>:dispatch:<sequence>
```

Start/end marks are cleared after measuring. Measures are cleared when their records are evicted or
when transaction history is cleared. The measure covers the same dispatch interval as
`totalDuration`; record serialization and subscriber notification happen afterward. Pass
`performanceMarks: false` to disable measures.

### Chrome Performance extension tracks

Set `performanceExtension: true` to opt into the
[Chrome DevTools Performance extensibility API](https://developer.chrome.com/docs/devtools/performance/extension).
While recording in Chrome, enable **Capture settings → Show custom tracks**. The library emits:

- a `ProseMirror Devtools · <instance label>` track group;
- a single `Dispatches` track containing each complete synchronous dispatch;
- exact `State apply` and `View update` spans nested into their dispatch by timestamp;
- exact `Custom code` gaps left between observed apply/update calls in a custom dispatcher;
- every instrumented plugin hook as an individually selectable nested entry;
- a shared `Markers` track for measured spans and point entries, with their category kept as
  metadata;
- point markers duplicated as global vertical timeline markers by default.

Every entry includes relevant dispatch, plugin, hook, marker, and duration properties for the
Performance summary pane. Application marker data is included as string properties. Customize the
group or reduce the emitted entries when a trace would otherwise be too busy:

The outer dispatch entry includes `Dispatcher: default` or `Dispatcher: custom`. For a custom
dispatcher it also exposes the callback duration as a property; it does not create a second,
overlapping custom-dispatch track.

```ts
attachProseMirrorDevtools({
  id: instanceId,
  label: "Article editor",
  view,
  performanceExtension: {
    trackGroup: "Editor diagnostics",
    dispatches: true,
    phases: true,
    customCode: true,
    customCodeThresholdMs: 0.05,
    pluginHooks: true,
    grouping: "dispatch",
    pluginHookThresholdMs: 0.05,
    markers: true,
    timelineMarkers: true,
  },
});
```

This option defaults to `false` because recording every plugin hook adds User Timing entries on a
hot path. It is independent from `performanceMarks`, which controls the existing plain dispatch
measure. Unsupported Performance extension payloads are ignored and never interrupt an editor
dispatch.

All entry switches default to `true` once `performanceExtension` is enabled. Dispatch grouping is
the default, keeping the outer dispatch, its phases, and its plugin hooks on one nested track. Set
`grouping: "phase"` for separate State apply/View update tracks, or `grouping: "plugin"` when a
trace specifically benefits from one track per plugin. Set `timelineMarkers: false` to keep point
markers only inside the shared `Markers` track.

`pluginHookThresholdMs` defaults to `0`, so the library emits every observed hook. Set it to a small
value such as `0.05` to reduce trace noise without changing the measurements retained by the panel.
Chrome may render very short entries as sub-pixel slivers until the timeline is zoomed in. A plugin
without a `state` field has no `state.apply` callback to emit, and a transaction rejected during
filtering never reaches state application.

`customCode` also defaults to `true`. For custom dispatchers, the library subtracts the union of
exact apply/view intervals from the callback interval and emits every remaining gap with start/end
offsets and duration. `customCodeThresholdMs` defaults to `0` and can suppress insignificant gaps.
The entries mean “unattributed synchronous custom-dispatch time”; code using unobservable bound or
deferred methods can also fall into this category.

### Custom dispatch integration

When the view already defines `dispatchTransaction`, attachment delegates to that exact function
with `this` bound to the `EditorView` and restores it on detach. During each synchronous callback,
the attachment temporarily observes the current state's public `apply`/`applyTransaction` methods
and the view's public `updateState`/`update` methods. Returned states are observed as the application
chain advances. Temporary wrappers are removed in `finally`; original descriptors are restored
unless the dispatcher intentionally replaces one of those methods, in which case that mutation is
preserved.

- `customDispatchDuration` is populated.
- `applyDuration` and `viewUpdateDuration` are populated when their corresponding synchronous
  public calls occur.
- Applying the dispatched transaction through those methods exposes rejected and appended
  transaction details without applying it a second time, once its exact resulting state is
  successfully installed as the final view state.
- Instrumented plugin hooks still appear when they execute synchronously during the custom call.

`customDispatchDuration` is the inclusive application callback and can contain state application,
view update, and arbitrary application work. `applyDuration` measures only observed
`EditorState.applyTransaction` calls inside that callback. These durations overlap and are not
additive. Views using ProseMirror's default dispatch path have no custom-dispatch phase.

The temporary method identities are observable from inside the custom callback, which is necessary
to measure the actual calls. Dispatchers that invoke previously bound methods, use a different state
object, or route updates entirely through a framework may leave one or both phase fields `null`. If
the dispatcher schedules work and returns, the measurement ends at that return. The later state
update, framework commit, browser layout, and paint are not included.

### Other limitations

- Plugin `view.update` runs synchronously inside `EditorView.updateState` and contributes to both
  that plugin's full synchronous cost and the editor-wide view-update phase.
- “View update” is synchronous ProseMirror reconciliation. Synchronous forced style/layout is
  included; later paint, compositing, animation frames, and async framework work are not.
- DOM event parsing and other work completed before `view.dispatch` is outside dispatch total.
- Direct `view.updateState` calls bypass attachment tracking. Replacing `dispatchTransaction` after
  attachment also replaces the profiling wrapper.
- Hook timings add timer and wrapper overhead; very small durations may be zero at reduced timer
  resolution.
- Nested hook timings are inclusive. The grouped panel merges their intervals for full synchronous
  cost; raw timing durations must not be summed as though they were exclusive phases.
- Hook calls outside an active dispatch update aggregates, but do not appear in a selected
  dispatch's span list. Initialization and plugin-view creation samples are buffered by instance id
  until the matching view attaches to the same store.
- Each transaction record serializes complete before/after documents, selection, steps, metadata,
  and changed ranges. Large documents make a conservative `transactionLimit` important.
- Synchronous errors are recorded and then rethrown; instrumentation does not swallow application
  failures.

## Programmatic snapshots

The snapshot helpers are available from `prosemirror-devtools/core`:

```ts
import {
  createSnapshot,
  loadSnapshots,
  persistSnapshots,
  restoreSnapshot,
} from "prosemirror-devtools/core";

const saved = createSnapshot("main-editor", view, "Before migration");
const snapshots = [saved, ...loadSnapshots("main-editor")];

persistSnapshots("main-editor", snapshots);
restoreSnapshot(view, saved);
```

Snapshots contain serialized document and selection JSON. Restoration parses the document with the
current editor schema and dispatches a replacement transaction, so schema compatibility is
required. An invalid/stale selection is ignored if the document itself is valid. Pass a custom
`Storage` implementation to `loadSnapshots`/`persistSnapshots` for tests or non-default storage.

## Inspection and serialization helpers

The core entry also exports:

- `inspectState`, `inspectPlugins`, and `inspectSchema`
- `serializeDocument` and bounded, circular-safe `serializeValue`
- `restoreDocument`
- store, transaction, timing, inspection, and snapshot types

`serializeValue` accepts `maxDepth`, `maxEntries`, and `maxStringLength` limits and replaces DOM
elements, functions, symbols, errors, maps, sets, circular references, and truncated data with safe
serialized representations.

## Package exports

| Export                              | Contents                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `prosemirror-devtools`              | All core APIs and types plus `ProseMirrorDevtoolsPanel`                                                            |
| `prosemirror-devtools/core`         | Store, attachment, instrumentation, serialization, inspection, and snapshot APIs without importing the React panel |
| `prosemirror-devtools/tanstack`     | `createProseMirrorDevtoolsPlugin`, panel component, and panel types                                                |
| `prosemirror-devtools/package.json` | Package metadata                                                                                                   |

## Development

From the repository root:

```sh
pnpm --filter prosemirror-devtools build
pnpm --filter prosemirror-devtools test
pnpm --filter prosemirror-devtools typecheck
pnpm --filter prosemirror-devtools dev
```

Run `pnpm dev` to open the private TanStack demo. Its playground editor uses the custom-dispatch
path, and the optional latency plugin makes slow-hook detection visible without a production
performance issue.

## License

[MIT](./LICENSE)
