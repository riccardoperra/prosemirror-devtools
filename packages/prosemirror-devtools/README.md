<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/riccardoperra/prosemirror-devtools/main/packages/prosemirror-devtools/assets/prosemirror-inspector-logo-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/riccardoperra/prosemirror-devtools/main/packages/prosemirror-devtools/assets/prosemirror-inspector-logo-light.svg" />
    <img src="https://raw.githubusercontent.com/riccardoperra/prosemirror-devtools/main/packages/prosemirror-devtools/assets/prosemirror-inspector-logo-light.svg" alt="ProseMirror Inspector" width="560" />
  </picture>
</p>

<p align="center">Inspect editor state. Trace transactions. Profile plugin performance.</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-work_in_progress-E58B54?style=flat-square" alt="Status: work in progress" />
  <a href="https://github.com/riccardoperra/prosemirror-devtools/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-347C96?style=flat-square" alt="License: MIT" /></a>
</p>

> **Work in progress:** this package is still under active development. APIs, integrations, and
> behavior may change between releases, including breaking changes. Feedback and bug reports are
> welcome in [GitHub Issues](https://github.com/riccardoperra/prosemirror-devtools/issues).

A development panel for inspecting and profiling ProseMirror editors.

Connect an `EditorView` once, then inspect its state, transaction history, plugins, schema,
snapshots, and synchronous performance. Render the panel directly in your application or add it to
TanStack Devtools.

> This package is development-only tooling. Recording editor activity and wrapping plugin hooks
> adds runtime overhead.

The new inspection client, standalone mount, recording, and agent APIs below are available in
workspace builds of this branch. Their npm release is pending. Build the repository before running
the native examples.

## Install

```sh
npm install --save-dev prosemirror-inspector
```

The application must already provide `prosemirror-model`, `prosemirror-state`, `prosemirror-transform`, and
`prosemirror-view`. React, Preact, Vue, Svelte, and Angular are optional peers and are needed only
when you use their matching adapters. Solid powers the native panel and is installed with the
package.

## Getting started

There are two parts to the integration: connect the editor, then choose where to render the panel.
Both the standalone and TanStack versions read from the same devtools store.

### 1. Connect a ProseMirror editor

Create a session before `EditorState` so it can optionally instrument the editor's plugins.
Attach the finished `EditorView`, then dispose the session during teardown.

```ts
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { createProseMirrorDevtoolsSession } from "prosemirror-inspector/core";

const devtools = import.meta.env.DEV
  ? createProseMirrorDevtoolsSession({
      id: "main-editor",
      label: "Main editor",
      captureProfile: "bounded",
    })
  : null;

const plugins = devtools ? devtools.instrumentPlugins(rawPlugins) : rawPlugins;
const state = EditorState.create({ schema, plugins });
const view = new EditorView(document.querySelector("#editor")!, { state });

devtools?.attach(view);

// When the editor is removed:
devtools?.dispose();
view.destroy();
```

`schema` and `rawPlugins` in this example are the application's existing editor configuration.

`instrumentPlugins` is optional. Skip it when you need only editor state, history, dispatch
phases, plugins, schema, and snapshots. Use it when you also want timings for individual plugin
hooks.

Plugin instrumentation must happen before `EditorState.create`. The returned plugins replace the
original objects, so never include both versions in the same state.

Run session setup only in development. The framework adapters disable their UI and registration
helpers automatically outside development, but direct core calls do not become no-ops.

### 2a. Mount without a framework

```ts
import { mountProseMirrorDevtools } from "prosemirror-inspector/standalone";

const panel = mountProseMirrorDevtools(container, { store, defaultPanel: "history" });
panel.update({ store, theme: "dark" });
panel.unmount();
```

The mount uses the same renderer as the framework adapters. `update` replaces the options.
`unmount` is idempotent. The normal mount is inactive unless `NODE_ENV` is `development`.
Editor registration remains separate.

### 2b. Render through a framework adapter

Framework adapters export a panel renderer that works without TanStack Devtools. This React
example uses the framework component in a fixed-height area of the application:

```tsx
import { ProseMirrorDevtoolsPanel } from "prosemirror-inspector/react";

export function EditorDevtools() {
  return (
    <aside style={{ height: 480 }}>
      <ProseMirrorDevtoolsPanel defaultPanel="state" />
    </aside>
  );
}
```

The package root also exports the native Solid-rendered `ProseMirrorDevtoolsPanel` for hosts that
already render Solid components.

### 2c. Add the panel to TanStack Devtools

Install the TanStack Devtools package for your framework:

```sh
npm install --save-dev @tanstack/react-devtools
```

Create the plugin once, outside the application component, and pass it to the TanStack shell:

```tsx
import { TanStackDevtools } from "@tanstack/react-devtools";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-inspector/react";

const prosemirrorDevtools = createProseMirrorDevtoolsPlugin({
  defaultOpen: false,
  defaultPanel: "state",
});

export function App() {
  return <TanStackDevtools plugins={[prosemirrorDevtools]} />;
}
```

Inside TanStack Devtools, the panel follows the shell's theme and uses its launcher and layout.

### Optional event and rendering diagnostics

Enable bounded capture when creating the session, then instrument plugins before creating the
editor state as in the quick start:

```ts
const devtools = createProseMirrorDevtoolsSession({
  id: "main-editor",
  diagnostics: { limit: 200 }, // `true` uses the same default.
});
const plugins = devtools.instrumentPlugins(rawPlugins);
// Create the state and view with these plugins, then devtools.attach(view).

function runBold() {
  const run = () => toggleMark(schema.marks.strong)(view.state, view.dispatch, view);
  return devtools.diagnostics ? devtools.diagnostics.traceCommand("Bold", run) : run();
}
```

The **Events & commands** and **Rendering** panels consume this capture. It is off
by default. `limit` caps retained events, NodeViews, decoration sources, ranges per source, and
dispatch references per event independently; it defaults to 200 and accepts 1–10,000. These limits
are separate from transaction history. Panels render captured lists in pages of 100.

Only wrapped plugin hooks are observed: diagnostics do not rerun decoration callbacks or inspect
uninstrumented editor props. Event records include handler order, exact boolean outcomes (or
unknown for other returns), duration, nested parent calls, errors, and synchronous dispatch IDs.
They exclude DOM events, targets, typed text, key characters, and clipboard payloads; safe metadata
includes event type, key code, and modifier flags. Application error messages and shallow scalar
decoration specs can still contain application data. `traceCommand` names one synchronous call,
preserves its return value/errors, and does not capture deferred work or discover commands
automatically.

Decoration ranges are the most recently observed result per plugin. Old-document ranges are marked
stale, and overlays are removed on document changes or when leaving the panel. NodeView records
retain lifecycle counts and durations without retaining their DOM.

Lower-level integrations can create a controller with `createProseMirrorDevtoolsDiagnostics`, then
pass the same `diagnostics` to `instrumentProseMirrorPlugins` and `attachProseMirrorDevtools` (or a
framework registration hook). Tiptap's `setupTiptapDevtools` also accepts this controller. Create one
controller per editor lifecycle. The caller disposes an externally supplied controller; sessions
dispose controllers they create from `true` or options. Controllers expose `getSnapshot`,
`subscribe`, `clearEvents`, and `clearNodeViews` for custom hosts.
`clearNodeViews` removes destroyed records and resets live counters while continuing to track
existing live views.

## Framework adapters

Every framework entrypoint exports a panel renderer and a TanStack Devtools plugin factory. Most
also provide a lifecycle helper for attaching an `EditorView`.

| Framework | Entrypoint                      | Registration helper         |
| --------- | ------------------------------- | --------------------------- |
| React     | `prosemirror-inspector/react`   | `useProseMirrorDevtools`    |
| Preact    | `prosemirror-inspector/preact`  | `useProseMirrorDevtools`    |
| Solid     | `prosemirror-inspector/solid`   | `useProseMirrorDevtools`    |
| Vue       | `prosemirror-inspector/vue`     | `useProseMirrorDevtools`    |
| Svelte    | `prosemirror-inspector/svelte`  | Use the core session        |
| Angular   | `prosemirror-inspector/angular` | `injectProseMirrorDevtools` |

The normal framework entrypoints render no UI and skip registration outside development mode.
Core APIs, the native root panel, and the Tiptap helpers are not automatically disabled, so guard
those calls with your build tool's development flag. Import
`prosemirror-inspector/<framework>/production` only when you intentionally want a framework
adapter to stay active in a production build.

## What the panel shows

| Section     | Panel             | Contents                                                                                           |
| ----------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| Document    | State             | Document tree and positions, node JSON, selection, active marks, and document statistics           |
| Document    | Selection         | Anchor/head ancestry, offsets, boundaries, adjacent nodes, ranges, and marks                       |
| Document    | Schema            | Node specs, mark specs, and the top node type                                                      |
| Timeline    | Transactions      | Root/appended transactions, document restore, step diffs, changed ranges, and position mapping     |
| Timeline    | Events & commands | Opt-in handler outcomes, nested calls, synchronous dispatch IDs, and named commands                |
| Snapshots   | Snapshots         | Local save, restore, import, export, and delete controls                                           |
| Performance | Performance       | Dispatch timeline, apply/view phases, plugin ranking, hook timings, markers, average, p95, and max |
| Plugins     | Plugins           | Searchable plugin order, state, runtime keys, and exposed editor props                             |
| Plugins     | Rendering         | Opt-in ranges/specs, position overlays, and NodeView lifecycle counters                            |
| Context     | Context           | Capture status, installed inspectors, and a copyable diagnostic context                            |

The top row of tabs lists the sections. A section with more than one panel shows its panels in a
second row, and selecting the section again reopens the panel you last used in it. Navigation
stays panel-based: `defaultPanel`, `activePanel` and `onActivePanelChange` take and report panel
IDs such as `schema` or `history`, and the matching section opens on its own.

Each panel host keeps its editor and inspection selection. Transactions and Performance share the
selected dispatch. **Follow live** returns to the current state. Historical document and provider
reads never substitute live data. The visible Transactions and Rendering names retain the public
panel IDs `history` and `decorations`.

Open **Context** to see capture status and installed inspectors. Expand **Technical details** for
semantic provider values, coverage, and availability reasons. **Copy diagnostic context** copies
a bounded target, point, selection, and coverage summary.

Transactions **Changes & mapping** mode uses captured step maps, including mirrors and custom steps.
Diffs are computed for the selected step, including marks and attributes. Filtered and unobserved
custom dispatch outcomes do not claim applied mapping results.

JSON branches render 100 children at a time with **Show more**. Closed document disclosures defer
serialization. Narrow layouts stack independently scrollable panes, embedded panels follow their
host height, and both tab rows support arrow keys, Home, and End.

## Tiptap 3

The Tiptap entrypoint integrates with Tiptap's lifecycle and native transaction middleware without
importing `@tiptap/core` into this package.

```ts
import { Extension } from "@tiptap/core";
import {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
} from "prosemirror-inspector/tiptap";

export const TiptapDevtools = Extension.create({
  name: "prosemirrorDevtools",
  priority: 10_000,

  onBeforeCreate() {
    setupTiptapDevtools(this.editor, {
      id: "main-editor",
      label: "Main editor",
    });
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

Add `TiptapDevtools` to the editor's `extensions` array. Keep a high priority so the measurement
surrounds ordinary lower-priority middleware. Do not call `props.next` yourself;
`dispatchTiptapTransaction` forwards it exactly once.

Keep Tiptap's `enableExtensionDispatchTransaction` option enabled (the default), and do not also
attach the same view through the generic core API. Either change would bypass or duplicate
recording.

Plugin instrumentation is enabled by default for this integration. Pass `instrumentPlugins: false`
when you need only transaction history and dispatch phases. Dynamically registered plugins are not
instrumented automatically.

The native fixture verifies Tiptap 3.31.4. Tiptap 2 has no native middleware verification here.

With `@tiptap/react`, call `resumeTiptapDevtools(editor)` in the editor effect setup and
`suspendTiptapDevtools(editor)` in its cleanup. Keep `detachTiptapDevtools` in `onDestroy` for terminal
cleanup. Suspension releases the registration before Tiptap's deferred destroy and permits Strict
Mode to resume the same editor. See the
[native Tiptap fixture](https://github.com/riccardoperra/prosemirror-devtools/tree/main/packages/tiptap-demo).

## Controlled React ProseMirror

Use `createReactProseMirrorDevtools` from `prosemirror-inspector/react-prosemirror` inside
`@handlewithcare/react-prosemirror`'s `useEditorEffect`. Pass the actual view and a `getState`
function that reads the application's authoritative controlled model.

Wrap model application in `connection.record(transaction, apply)`. Apply the transaction once,
update the model reference, and schedule React state from `apply`. Return `connection.dispose`
from the effect cleanup. The helper does not patch the view dispatcher or force `view.updateState`.
A later React commit is outside this synchronous measurement boundary.

The [controlled fixture](https://github.com/riccardoperra/prosemirror-devtools/tree/main/packages/react-prosemirror-demo)
verifies React ProseMirror 3.2.11, React 19.2.8, react-reconciler 0.33.0, and ProseMirror view 1.42.3.
Its `Connection` and dispatch callback form the complete integration. Keep one compatible
ProseMirror runtime and guard connection setup in development.

## Plugin performance

`instrumentPlugins` creates replacement `Plugin` objects and measures synchronous calls to:

- `state.init` and `state.apply`;
- `filterTransaction` and `appendTransaction`;
- function-valued editor props and DOM event handlers;
- node-view creation, updates, events, selection, mutation handling, and cleanup;
- plugin-view creation, updates, and cleanup.

Return values and thrown errors are preserved, and runtime plugin keys remain stable. Strict object
identity does not: code that needs a stable lookup should use a `PluginKey`.

One call to `view.dispatch` creates one history record. With the default dispatcher, the panel
separates time spent applying state from the synchronous view update. An existing custom
`dispatchTransaction` is preserved and called with its original `this` value; public
`applyTransaction` and `updateState` calls made synchronously inside it are observed where
possible.

The timings cover synchronous ProseMirror work. Browser paint, compositing, work before dispatch,
deferred updates, and asynchronous framework commits are outside the measurement.

## Multiple editors and isolated stores

The default `prosemirrorDevtoolsStore` is shared. Give every live editor a unique public id and the
panel will offer an instance selector.

```ts
const articleDevtools = createProseMirrorDevtoolsSession({
  id: "article-editor",
  label: "Article",
});

const commentsDevtools = createProseMirrorDevtoolsSession({
  id: "comments-editor",
  label: "Comments",
});
```

Create a store when a test, application root, or panel must be isolated:

```tsx
import {
  createProseMirrorDevtoolsSession,
  createProseMirrorDevtoolsStore,
} from "prosemirror-inspector/core";
import { ProseMirrorDevtoolsPanel } from "prosemirror-inspector/react";

const store = createProseMirrorDevtoolsStore();

const devtools = createProseMirrorDevtoolsSession({
  id: "main-editor",
  store,
});

export function Devtools() {
  return <ProseMirrorDevtoolsPanel store={store} />;
}
```

Pass the same store to the session, panel, and TanStack plugin. Sessions also own a private
lifecycle id, so a later editor can safely reuse the same public id after the earlier session is
disposed.

History is unbounded by default. Use `captureProfile: "bounded"`, `createBoundedCaptureProfile`, or `transactionLimit` when a long-running session needs a fixed
retention cap, or clear history from the panel. Persistent before/after and intermediate step
documents are retained until their JSON or diffs are inspected; full EditorState objects are not
retained by history.

## Custom performance markers

Add application-specific events or synchronous spans to the dispatch that is currently being
recorded:

```ts
import { markProseMirrorDevtools, measureProseMirrorDevtools } from "prosemirror-inspector/core";

markProseMirrorDevtools("main-editor", "Remote steps received", {
  category: "collaboration",
  data: { count: steps.length },
});

const result = measureProseMirrorDevtools(
  "main-editor",
  "Rebase remote steps",
  () => rebaseSteps(steps),
  { category: "collaboration", tone: "warning" },
);
```

A point marker returns `false` when no dispatch is active. A measured callback always runs; it is
simply not recorded when called outside a dispatch.

## Panel extensions

Add application-specific tabs without coupling them to a UI framework. Each extension panel is a
section of its own in the top row, placed by its `order`. An extension receives scoped data, safe
actions, host details, and a cleanup signal.

```ts
import type { DevtoolsExtension } from "prosemirror-inspector/core";

export const collaborationExtension: DevtoolsExtension = {
  id: "collaboration",
  panels: [
    {
      id: "collaboration-status",
      title: "Collaboration",
      requiresInstance: false,
      mount(container, { data }) {
        const render = () => {
          const editor = data.activeInstance();
          container.textContent = editor ? `Active editor: ${editor.label}` : "No editor connected";
        };

        render();
        return data.activeInstance.subscribe(render);
      },
    },
  ],
};
```

Pass the extension to either host:

```tsx
<ProseMirrorDevtoolsPanel extensions={[collaborationExtension]} />;

const plugin = createProseMirrorDevtoolsPlugin({
  extensions: [collaborationExtension],
});
```

React hosts can use `createReactDevtoolsExtension` for React-rendered extension panels. All other
frameworks can implement the same DOM `mount(container, context) => cleanup` contract.

### Add details to Transactions and Events

Register a `DevtoolsDispatchPresenter` in a panel host's `extensions` option. Match the inspector's descriptor ID and version exactly. Register the inspector separately in the editor session's `inspectors` option. A presenter-only extension uses `panels: []`. The [kitchen sink example](../collab-demo/src/text-impact.ts) defines both parts.

`present({ value, record })` receives an available, serialized capture and its retained dispatch. Return `label` and `text` for the detail in Transactions and in linked Events, with optional `badge` and `note`. Include `listLabel` to show the badge and a short description in the Transactions list. Return `undefined` to hide the sample. Keep the function synchronous and free of side effects because the same dispatch can render in several places.

Registration belongs to each panel host. A host presenter takes precedence over a built-in presenter for the same inspector and version. Two host presenters cannot claim the same pair. If a presenter throws, the detail marks the presentation as unavailable and keeps the raw capture accessible in Transactions.

### Inspect WebMCP calls

Pass the inspector's extension to the standalone panel or the TanStack plugin. To record tool
executions, pass the same inspector to the bridges your app uses.

```ts
import { createProseMirrorWebMcpInspector } from "prosemirror-inspector";
import {
  installProseMirrorChromeBridge,
  installProseMirrorWebMCPBridge,
} from "prosemirror-inspector/agent";

const webMcp = createProseMirrorWebMcpInspector();
const extensions = [webMcp.extension];
const disposeChromeBridge = installProseMirrorChromeBridge(client, { inspector: webMcp });
const disposeWebMcpBridge = await installProseMirrorWebMCPBridge(client, webMcp);
```

Register custom ProseMirror tools through `webMcp.registerTool(tool)`. It returns a cleanup
function for each tool. The **WebMCP** tab lists native registrations and retains recent
executions from both bridges in memory. Each call shows its source, status, duration, and input
and result previews. The inspector records calls while other tabs are open. On teardown, call
`disposeChromeBridge()`, `disposeWebMcpBridge?.()`, and `webMcp.dispose()`.

## Themes and styling

The native panel accepts `theme="system"`, `"light"`, or `"dark"`. A panel hosted by TanStack
Devtools inherits the shell theme and avoids duplicate appearance controls.

The panel loads scoped styles automatically. Stable `--prosemirror-devtools-*` CSS custom
properties let applications and extension panels adjust colors, typography, shadows, and radius
without depending on generated class names. Typed variable names are exported from
`prosemirror-inspector/styles`; the compiled stylesheet is available as
`prosemirror-inspector/styles.css` for custom hosts.

## Performance options

`performanceFrameBudgetMs` controls the reference line and minimum chart scale. It defaults to a
60 FPS budget:

```tsx
<ProseMirrorDevtoolsPanel performanceFrameBudgetMs={1000 / 120} />
```

Each retained dispatch creates a browser User Timing measure by default. Set
`performanceMarks: false` on the session or attachment to disable those measures.

Chrome's Performance panel can also show dispatches, phases, plugin hooks, and application markers
as custom tracks:

```ts
const devtools = createProseMirrorDevtoolsSession({
  id: "main-editor",
  performanceExtension: true,
});
```

While recording in Chrome, enable **Capture settings → Show custom tracks**. Pass an options object
instead of `true` to choose the track grouping or filter very short plugin hooks. This integration
uses Chrome's Performance extensibility API and is ignored in unsupported browsers.

## Snapshots

The built-in Snapshots panel stores serialized document and selection JSON in `localStorage`,
scoped by editor id. Nothing is uploaded.

Restoring a snapshot dispatches a normal transaction through the current editor. The saved document
must therefore be compatible with the current schema. An invalid saved selection is ignored when
the document itself can still be restored.

Programmatic helpers are available from the core entrypoint:

```ts
import {
  createSnapshot,
  loadSnapshots,
  persistSnapshots,
  restoreSnapshot,
} from "prosemirror-inspector/core";
```

## Read evidence and run agent checks

```ts
import { createProseMirrorInspectionClient } from "prosemirror-inspector/core";
import {
  evaluateProseMirrorInspection,
  installProseMirrorChromeBridge,
} from "prosemirror-inspector/agent";

const client = createProseMirrorInspectionClient({ store });
const target = client.listEditors()[0]?.target;
if (target) {
  const pinned = client.pin({ target });
  if (pinned.kind === "available") {
    const document = client.read({ point: pinned.value, query: { kind: "document" } });
  }
}
```

Every result declares its target, point, and coverage. Reusing an expired target or point returns
`expired`. `evaluateProseMirrorInspection` returns `passed`, `failed`, or `inconclusive` for a
semantic expectation. A semantic match does not establish browser rendering.

`installProseMirrorChromeBridge(client)` enables experimental Chrome DevTools MCP third-party
query discovery and returns its cleanup. Enable it only in development with a compatible Chrome
and MCP setup. It uses the same query catalogue and does not start a server.

The package ships `prosemirror-inspector-integrate`, `prosemirror-inspector-debug`, and
`prosemirror-inspector-validate` under `skills/`. For Codex projects, copy them into `.agents/skills`
from the installed package. npm does not activate skills automatically. The
[agent guide](https://github.com/riccardoperra/prosemirror-devtools/blob/main/docs/agent-validation.md)
describes installation, prerequisites, browser evidence, and the list and undo scenario.

`await installProseMirrorWebMCPBridge(client)` registers the same tools for native WebMCP
browser agents. It returns cleanup, or `null` when unsupported. Registration uses the current
`document.modelContext` API and supports the earlier `navigator.modelContext` API. Enable it
only in development and call its cleanup when the host is removed. The adapter does not install
a polyfill or require a Chrome DevTools MCP server. Native WebMCP remains experimental.

## Semantic inspectors

Use `createHistoryInspector({ plugin })` from `prosemirror-inspector/inspectors/history` with the
installed `history()` plugin. Pass the provider through the session's `inspectors` option.
It captures public undo and redo depths and observed history metadata.

Use `createPluginStateInspector` from the core entry for bounded application-defined plugin state.
Historical queries read its captured projection. Use `createTiptapInspector` from
`prosemirror-inspector/inspectors/tiptap` for extension, options, and storage samples. Known plugin
associations must be supplied by the application.

The [support matrix](https://github.com/riccardoperra/prosemirror-devtools/blob/main/docs/support-matrix.md)
and [inspection reference](https://github.com/riccardoperra/prosemirror-devtools/blob/main/docs/inspection.md)
describe scopes and limits. New entries on the working branch are unreleased until a package
release includes them.

For official collaboration, use `createCollabInspector` from `prosemirror-inspector/inspectors/collab`.
Pass the installed `collab()` plugin. For Yjs, use `createYjsInspector` from
`prosemirror-inspector/inspectors/yjs` with the actual Y.Doc and binding UndoManager.
`createTransportObserver` from `prosemirror-inspector/inspectors/transport` accepts explicit
application network signals. The session captures historical semantic projections.

## Share diagnostic recordings

`exportProseMirrorRecording({ client, target })` from `prosemirror-inspector/recordings` exports the
latest 25 dispatch IDs and bounded current scopes by default, within a hard 2 MB total limit.
Read the artifact's coverage and omissions. `parseProseMirrorRecording` validates an imported file.
`createProseMirrorRecordingClient` opens a fresh offline source with only exact captured query scopes.

Use `mountProseMirrorRecordingInspector` from `prosemirror-inspector/recordings-panel` to read it in
a separate development viewer. Import does not attach a view or restore a live editor. The
[recording guide](https://github.com/riccardoperra/prosemirror-devtools/blob/main/docs/recordings.md)
describes export, import, limits, and teardown.

## Package exports

| Export                                         | Purpose                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `prosemirror-inspector`                        | Core APIs plus the native Solid-rendered panel                                                   |
| `prosemirror-inspector/core`                   | Sessions, stores, instrumentation, inspection, serialization, markers, extensions, and snapshots |
| `prosemirror-inspector/performance`            | Framework-neutral timing, grouping, ranking, and summary helpers                                 |
| `prosemirror-inspector/styles`                 | Typed names for the panel's public CSS custom properties                                         |
| `prosemirror-inspector/styles.css`             | Compiled panel stylesheet for explicit CSS-only use                                              |
| `prosemirror-inspector/react`                  | React panel, registration hook, TanStack plugin, and extension adapter                           |
| `prosemirror-inspector/preact`                 | Preact panel, registration hook, and TanStack plugin                                             |
| `prosemirror-inspector/solid`                  | Solid panel, registration helper, and TanStack plugin                                            |
| `prosemirror-inspector/vue`                    | Vue panel, registration composable, and TanStack plugin                                          |
| `prosemirror-inspector/svelte`                 | Svelte panel and TanStack plugin                                                                 |
| `prosemirror-inspector/angular`                | Angular panel, injection helper, and TanStack plugin                                             |
| `prosemirror-inspector/<framework>/production` | Explicit production-enabled version of a framework adapter                                       |
| `prosemirror-inspector/standalone`             | Framework-neutral development mount, update, and cleanup                                         |
| `prosemirror-inspector/react-prosemirror`      | Controlled native model recorder for React ProseMirror                                           |
| `prosemirror-inspector/recordings`             | Bounded diagnostic export, validated import, and offline queries                                 |
| `prosemirror-inspector/recordings-panel`       | Separate read-only recording component and development mount                                     |
| `prosemirror-inspector/agent`                  | Read-only agent tools, semantic checks, native WebMCP, and Chrome discovery                      |
| `prosemirror-inspector/inspectors/history`     | Official undo and redo history observations                                                      |
| `prosemirror-inspector/inspectors/collab`      | Official collaboration version, pending steps, and original transaction metadata                 |
| `prosemirror-inspector/inspectors/transport`   | Explicit application transport observations                                                      |
| `prosemirror-inspector/inspectors/yjs`         | Y.Doc signals, provider projection, and collaborative undo                                       |
| `prosemirror-inspector/inspectors/tiptap`      | Tiptap extension and storage observations                                                        |
| `prosemirror-inspector/tiptap`                 | Tiptap 3 lifecycle and transaction-middleware helpers                                            |

## License

[MIT](https://github.com/riccardoperra/prosemirror-devtools/blob/main/LICENSE) © 2026
[Riccardo Perra](https://github.com/riccardoperra).
