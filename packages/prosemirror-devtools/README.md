# prosemirror-devtools

A development panel for inspecting and profiling ProseMirror editors.

Connect an `EditorView` once, then inspect its state, transaction history, plugins, schema,
snapshots, and synchronous performance. Render the panel directly in your application or add it to
TanStack Devtools.

> This package is development-only tooling. Recording editor activity and wrapping plugin hooks
> adds runtime overhead.

## Install

```sh
npm install --save-dev prosemirror-devtools
```

The application must already provide `prosemirror-model`, `prosemirror-state`, and
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
import { createProseMirrorDevtoolsSession } from "prosemirror-devtools/core";

const devtools = createProseMirrorDevtoolsSession({
  id: "main-editor",
  label: "Main editor",
});

const plugins = devtools.instrumentPlugins(rawPlugins);
const state = EditorState.create({ schema, plugins });
const view = new EditorView(document.querySelector("#editor")!, { state });

devtools.attach(view);

// When the editor is removed:
devtools.dispose();
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

### 2a. Render a standalone panel

Framework adapters export a panel renderer that works without TanStack Devtools. This React
example uses the framework component in a fixed-height area of the application:

```tsx
import { ProseMirrorDevtoolsPanel } from "prosemirror-devtools/react";

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

### 2b. Add the panel to TanStack Devtools

Install the TanStack Devtools package for your framework:

```sh
npm install --save-dev @tanstack/react-devtools
```

Create the plugin once, outside the application component, and pass it to the TanStack shell:

```tsx
import { TanStackDevtools } from "@tanstack/react-devtools";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/react";

const prosemirrorDevtools = createProseMirrorDevtoolsPlugin({
  defaultOpen: false,
  defaultPanel: "state",
});

export function App() {
  return <TanStackDevtools plugins={[prosemirrorDevtools]} />;
}
```

Inside TanStack Devtools, the panel follows the shell's theme and uses its launcher and layout.

## Framework adapters

Every framework entrypoint exports a panel renderer and a TanStack Devtools plugin factory. Most
also provide a lifecycle helper for attaching an `EditorView`.

| Framework | Entrypoint                     | Registration helper         |
| --------- | ------------------------------ | --------------------------- |
| React     | `prosemirror-devtools/react`   | `useProseMirrorDevtools`    |
| Preact    | `prosemirror-devtools/preact`  | `useProseMirrorDevtools`    |
| Solid     | `prosemirror-devtools/solid`   | `useProseMirrorDevtools`    |
| Vue       | `prosemirror-devtools/vue`     | `useProseMirrorDevtools`    |
| Svelte    | `prosemirror-devtools/svelte`  | Use the core session        |
| Angular   | `prosemirror-devtools/angular` | `injectProseMirrorDevtools` |

The normal framework entrypoints render no UI and skip registration outside development mode.
Core APIs, the native root panel, and the Tiptap helpers are not automatically disabled, so guard
those calls with your build tool's development flag. Import
`prosemirror-devtools/<framework>/production` only when you intentionally want a framework
adapter to stay active in a production build.

## What the panel shows

| Panel       | Contents                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------- |
| State       | Document tree and positions, node JSON, selection, active marks, and document statistics           |
| History     | Root and appended transactions, steps, metadata, before/after documents, and document restore      |
| Performance | Dispatch timeline, apply/view phases, plugin ranking, hook timings, markers, average, p95, and max |
| Plugins     | Searchable plugin order, state, runtime keys, and exposed editor props                             |
| Schema      | Node specs, mark specs, and the top node type                                                      |
| Snapshots   | Local save, restore, import, export, and delete controls                                           |

When several editors are registered, the toolbar lets you switch the active instance without
remounting the panel.

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
} from "prosemirror-devtools/tiptap";

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

This adapter uses the `dispatchTransaction` extension middleware introduced in Tiptap 3. For
Tiptap 2, use the generic core integration.

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
} from "prosemirror-devtools/core";
import { ProseMirrorDevtoolsPanel } from "prosemirror-devtools/react";

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

History is unbounded by default. Use `transactionLimit` when a long-running session needs a fixed
retention cap, or clear history from the panel.

## Custom performance markers

Add application-specific events or synchronous spans to the dispatch that is currently being
recorded:

```ts
import { markProseMirrorDevtools, measureProseMirrorDevtools } from "prosemirror-devtools/core";

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

Add application-specific tabs without coupling them to a UI framework. An extension receives
scoped data, safe actions, host details, and a cleanup signal.

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

## Themes and styling

The native panel accepts `theme="system"`, `"light"`, or `"dark"`. A panel hosted by TanStack
Devtools inherits the shell theme and avoids duplicate appearance controls.

The panel loads scoped styles automatically. Stable `--prosemirror-devtools-*` CSS custom
properties let applications and extension panels adjust colors, typography, shadows, and radius
without depending on generated class names. Typed variable names are exported from
`prosemirror-devtools/styles`; the compiled stylesheet is available as
`prosemirror-devtools/styles.css` for custom hosts.

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
} from "prosemirror-devtools/core";
```

## Package exports

| Export                                        | Purpose                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `prosemirror-devtools`                        | Core APIs plus the native Solid-rendered panel                                                   |
| `prosemirror-devtools/core`                   | Sessions, stores, instrumentation, inspection, serialization, markers, extensions, and snapshots |
| `prosemirror-devtools/performance`            | Framework-neutral timing, grouping, ranking, and summary helpers                                 |
| `prosemirror-devtools/styles`                 | Typed names for the panel's public CSS custom properties                                         |
| `prosemirror-devtools/styles.css`             | Compiled panel stylesheet for explicit CSS-only use                                              |
| `prosemirror-devtools/react`                  | React panel, registration hook, TanStack plugin, and extension adapter                           |
| `prosemirror-devtools/preact`                 | Preact panel, registration hook, and TanStack plugin                                             |
| `prosemirror-devtools/solid`                  | Solid panel, registration helper, and TanStack plugin                                            |
| `prosemirror-devtools/vue`                    | Vue panel, registration composable, and TanStack plugin                                          |
| `prosemirror-devtools/svelte`                 | Svelte panel and TanStack plugin                                                                 |
| `prosemirror-devtools/angular`                | Angular panel, injection helper, and TanStack plugin                                             |
| `prosemirror-devtools/<framework>/production` | Explicit production-enabled version of a framework adapter                                       |
| `prosemirror-devtools/tiptap`                 | Tiptap 3 lifecycle and transaction-middleware helpers                                            |

## License

[MIT](./LICENSE)
