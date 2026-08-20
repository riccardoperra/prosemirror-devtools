# prosemirror-devtools

Runtime observability for ProseMirror: inspect editor state, switch between live instances, retain
transaction history, and find slow plugin hooks from a compact Solid-rendered panel or inside TanStack
Devtools.

> Use this as development tooling. Wrapping hooks and recording serialized history adds overhead.

## Install

```sh
pnpm add -D prosemirror-devtools
```

The core entrypoint expects ProseMirror only. The built-in panel uses Solid 1, installed as a direct
runtime dependency; React, Preact, Vue, Svelte, and Angular remain optional peers used only by their
matching adapters.

## Quick start

The setup order is important:

1. Create one devtools session for the editor lifecycle.
2. Optionally instrument raw plugins before `EditorState.create`.
3. Create the `EditorState` and `EditorView`.
4. Attach the completed view through the session.
5. Dispose the session before destroying the view.

```ts
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createProseMirrorDevtoolsSession } from "prosemirror-devtools/core";

const devtools = createProseMirrorDevtoolsSession({
  id: "main-editor",
  label: "Main editor",
  performanceMarks: true,
  performanceExtension: true,
  getPluginLabel(plugin, index) {
    return `Plugin ${index + 1}`;
  },
});
const rawPlugins = [new Plugin({})];
const plugins = devtools.instrumentPlugins(rawPlugins); // Explicitly opt into hook timings.

const state = EditorState.create({ schema, plugins });
const view = new EditorView(document.querySelector("#editor")!, { state });

devtools.attach(view);

// On teardown:
devtools.dispose();
view.destroy();
```

The session owns a private timing namespace in addition to the public editor id, so an old plugin
view cannot leak samples into a later same-id editor. `attachProseMirrorDevtools` and
`instrumentProseMirrorPlugins` remain available as lower-level APIs; when using them together,
provide the same `sessionId` if lifecycle isolation is required. Never include both a raw plugin and
its wrapped replacement in the same state.

Framework adapters that already own dispatch middleware can call
`session.createDispatchRecorder(view)` and wrap their native `next(transaction)` call with
`recorder.record(transaction, next)` instead of replacing the view dispatcher. The Tiptap adapter
uses the same lifecycle/session boundaries.

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

`state.init` and plugin-view creation happen before an `EditorView` can be attached, so those two
startup timings are carried into the instance's initial plugin summary. Other hooks are recorded
only while that instance is registered.

The panel presents `props.decorations` as **Decoration change**. That timing covers the plugin callback
that produces a `DecorationSet`; later decoration mapping and DOM reconciliation cannot be
attributed to that callback safely and remain part of the surrounding view-update duration.

Return values and thrown errors are preserved. Wrappers are cached for the same original plugin,
private session, instance id, and store. Runtime plugin keys are kept stable so plugin state lookup
continues to work, including for plugins without an explicit `PluginKey`.

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

// Solid example. Pass `store` to instrumentation and attachment too.
export function EditorDiagnostics() {
  return <ProseMirrorDevtoolsPanel store={store} defaultPanel="performance" />;
}
```

For custom hosts, `getSnapshot` includes each live `EditorView`, so
`instance.view.state` is always the complete current editor state. Historical records deliberately
do not retain complete `EditorState` objects. Use `createDevtoolsDataAccess(store)` for a smaller
framework-neutral surface with:

- active-instance, descriptor, and per-instance readables;
- `subscribeDispatch`, which receives ordered batches containing short-lived before/after
  `EditorState` objects and the recorded transaction;
- separate safe actions for active-instance selection and clearing.

Read a value by calling it (`data.activeInstance()`) or with its equivalent `.get()` method, and
observe changes with `.subscribe(listener)`.

Signal values update immediately, while listener delivery is batched until the outermost nested
dispatch completes. A persistence extension can write each ordered dispatch batch to IndexedDB or
another store without coupling durable storage to the recorder.

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
import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/react";

const prosemirrorPlugin = createProseMirrorDevtoolsPlugin({
  id: "prosemirror-devtools",
  name: "ProseMirror",
  defaultOpen: false,
  performanceFrameBudgetMs: 1000 / 60,
  // performanceDetailThresholdMs: 0.5, // optional fixed override
  // store, // optional; defaults to the shared singleton
});

export function App() {
  return <TanStackDevtools plugins={[prosemirrorPlugin]} />;
}
```

The adapter follows the shell's light/dark theme. It also exports a native
`ProseMirrorDevtoolsPanel`, `useProseMirrorDevtools`, and their adapter types.

React, Preact, Solid, Vue, Svelte, and Angular adapters use `@tanstack/devtools-utils`. Their normal
entrypoints select no-op versions of their exported runtime APIs outside development. Import the
explicit `/<framework>/production` path to intentionally keep the real devtools in a production
bundle:

```ts
import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/react/production";
```

## Standalone Solid panel

```tsx
import { ProseMirrorDevtoolsPanel } from "prosemirror-devtools";
import { render } from "solid-js/web";

const dispose = render(
  () => (
    <ProseMirrorDevtoolsPanel
      defaultPanel="state"
      theme="system"
      performanceFrameBudgetMs={1000 / 60}
      className="my-devtools"
      style={{ height: "520px" }}
    />
  ),
  document.querySelector("#devtools")!,
);

// On teardown:
dispose();
```

Use the matching `prosemirror-devtools/<framework>` entrypoint when a framework component, lifecycle
helper, or TanStack Devtools plugin is more convenient. Every adapter mounts this same panel
renderer; Solid applications can also render the root component directly as shown above.

`theme` accepts `"system"`, `"light"`, or `"dark"`. The panel injects its own scoped styles when
mounted and provides an in-panel theme cycle in standalone use. TanStack-hosted panels inherit the
host theme and omit duplicate appearance controls. Pass a
`styleTarget` document when rendering into a popup or picture-in-picture document; the TanStack
adapter does this automatically.

`performanceFrameBudgetMs` defaults to `1000 / 60`. It draws the performance timeline reference
line and acts as the minimum upper bound of its Y scale, so very fast dispatches remain visually
small instead of filling the chart. For a 120 FPS budget use `1000 / 120`. This is a synchronous
dispatch-time comparison; it does not measure the browser's actual frame rate.

When `performanceDetailThresholdMs` is omitted, the panel averages the fastest 20% of the 60
visible dispatches and uses four times that value as the detail threshold, capped at one quarter of
the frame budget. The adaptive zone can use up to 42 chart pixels and gives every positive dispatch
at least six painted pixels. Tooltips keep the exact values. Pass a number for a fixed threshold or
`0` for a fully linear Y scale.

## Panel extensions and framework hosts

`ProseMirrorDevtoolsPanel` has a per-host `extensions` registry. Built-in and extension panels
share one keyboard-accessible tab host, and navigation can be uncontrolled with `defaultPanel` or
controlled with `activePanel`/`onActivePanelChange`. Panel ids must be unique within that host.

The canonical extension contract is DOM-based, so Vue, Angular, Svelte, Web Components, or plain
JavaScript can mount and clean up their own UI without importing React:

```ts
import type { DevtoolsExtension } from "prosemirror-devtools/core";

export const collaborationExtension: DevtoolsExtension = {
  id: "collaboration",
  panels: [
    {
      id: "collaboration-status",
      title: "Collaboration",
      requiresInstance: false,
      mount(container, { data }) {
        const render = () => {
          const instance = data.activeInstance();
          container.textContent = instance
            ? `Active editor: ${instance.id} (${instance.view.state.doc.content.size} positions)`
            : "No active editor";
        };
        render();
        const unsubscribe = data.activeInstance.subscribe(render);
        return unsubscribe;
      },
    },
  ],
};
```

```tsx
<ProseMirrorDevtoolsPanel
  extensions={[collaborationExtension]}
  defaultPanel="collaboration-status"
/>
```

The context intentionally separates `data`, `actions`, and `host`. Extensions can read the live
view/state, subscribe to only the data they need, query history in windows, observe raw dispatch
batches, and invoke a small set of host-safe actions. They do not receive transaction-recorder
internals. `host` supplies the owning document, resolved theme, density, panel navigation, and an
abort signal.

React extension panels can use the adapter, which mounts an isolated React root through the same
DOM extension lifecycle:

```tsx
import { createReactDevtoolsExtension } from "prosemirror-devtools/react";

const diagnosticsExtension = createReactDevtoolsExtension({
  id: "diagnostics",
  panels: [
    {
      id: "diagnostics-overview",
      title: "Diagnostics",
      render: ({ data }) => <Diagnostics data={data} />,
    },
  ],
});
```

Other framework conveniences can implement the same `mount(container, context) => cleanup`
contract without changes to the recorder or panel host.

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

- An interactive TanStack Charts stacked bar for a navigable window of up to 60 retained
  dispatches, updated after every dispatch and selectable by pointer or keyboard.
- A configurable dispatch-time budget line (16.7 ms / 60 FPS by default) and stable minimum Y
  scale, with labeled time and dispatch axes.
- An adaptive low-duration detail zone based on the fastest visible dispatches, exact tooltip
  values, and explicit previous/next dispatch controls.
- Apply, view-update, or inclusive custom-dispatch phase segments.
- One compact timeline toolbar for dispatch count, average, p95, maximum, navigation, and the phase
  legend. The retained-record count appears only when it differs from the total dispatch count.
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

The UI-independent calculations are available from the performance feature entrypoint:

```ts
import {
  buildDispatchPhaseBreakdown,
  buildPerformanceSummary,
  groupPluginTimings,
} from "prosemirror-devtools/performance";

const groups = groupPluginTimings(transactionRecord.timings);
const phases = buildDispatchPhaseBreakdown(transactionRecord);
```

That entrypoint also exports interval union/coverage, exact custom-code gaps, dispatch-cost
coverage, phase/plugin timeline models, ranking visibility, and their TypeScript types. It imports
neither React nor chart dependencies, so custom reporters and non-React integrations can reuse the
same semantics as the built-in panel.

One root call to `view.dispatch` produces one `TransactionRecord`. Its
`appliedTransactionCount` includes accepted appended transactions, while
`appendedTransactionCount` excludes the root. A rejected root transaction has zero applied
transactions and is marked as filtered.

History is unbounded by default; there is no automatic record eviction. An explicit
`transactionLimit` remains as an opt-in escape hatch and `null` removes a previously configured
cap. Headline average/p95/max values use in-memory records, while the built-in chart navigates them
in windows of 60 and History renders the newest 200 rows before offering older pages. Plugin hook
aggregates cover calls since attachment or the last `clearTransactions` call.

### User Timing measures

`performanceMarks` defaults to `true`. Each retained dispatch creates a browser User Timing measure
with this shape:

```text
prosemirror-devtools:<encoded-session-id>:<encoded-instance-id>:dispatch:<sequence>
```

The private session namespace prevents same-id editors in isolated stores or later lifecycles from
colliding in the browser buffer. The measure is created directly from a monotonic start and
duration, so no temporary start/end marks are needed. Measures are cleared when their records are
explicitly removed or history is cleared. The measure covers the same dispatch interval as
`totalDuration`; record normalization and subscriber notification happen afterward. Pass
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
  dispatch's span list. Initialization and plugin-view creation samples are buffered by private
  session plus instance id until the matching view attaches to the same store.
- Historical records normalize transactions, selection, metadata, and steps without retaining the
  full before/after `EditorState` (and therefore arbitrary plugin state). Persistent ProseMirror
  document nodes are held until their JSON is requested, then released by the record. Unbounded
  history still consumes memory over a long session; clear it explicitly or opt into a cap when
  that tradeoff matters.
- Raw dispatch subscribers receive complete before/after states when the outermost synchronous
  dispatch completes. They must copy or persist anything they want to retain.
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
- `serializeDocument`
- `restoreDocument`
- store, transaction, timing, inspection, and snapshot types

## Package exports

| Export                                        | Contents                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `prosemirror-devtools`                        | All core APIs and types plus the native Solid-rendered panel                                                           |
| `prosemirror-devtools/core`                   | Store, session, data/extension contracts, instrumentation, serialization, inspection, and snapshots without UI imports |
| `prosemirror-devtools/performance`            | Pure interval, attribution, grouping, summary, ranking, and timeline models                                            |
| `prosemirror-devtools/react`                  | React panel wrapper, plugin factory, registration hook, and React extension adapter                                    |
| `prosemirror-devtools/preact`                 | Preact panel, plugin factory, and registration hook                                                                    |
| `prosemirror-devtools/solid`                  | Solid adapter panel, plugin factory, and registration helper                                                           |
| `prosemirror-devtools/vue`                    | Vue panel, plugin factory, and registration composable                                                                 |
| `prosemirror-devtools/svelte`                 | Svelte panel and plugin factory                                                                                        |
| `prosemirror-devtools/angular`                | Angular panel, plugin factory, and injection helper                                                                    |
| `prosemirror-devtools/<framework>/production` | Explicitly enabled version of the matching framework adapter                                                           |
| `prosemirror-devtools/tiptap`                 | Tiptap 3 lifecycle and native dispatch-middleware adapter                                                              |
| `prosemirror-devtools/package.json`           | Package metadata                                                                                                       |

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
