# ProseMirror Devtools

See what is happening inside a ProseMirror editor while you build it.

ProseMirror Devtools gives you a live view of editor state, transactions, plugins, schema, and
performance. Use the panel on its own in your application or add it to TanStack Devtools alongside
the rest of your development tools.

> ProseMirror Devtools is development-only tooling. It records editor activity and adds a small
> amount of runtime overhead.

## What you can inspect

- **State** — explore the document tree, selection, active marks, and document statistics.
- **History** — inspect dispatches, step diffs and position mapping, and restore an earlier document.
- **Selection** — inspect anchor/head ancestry, boundaries, adjacent nodes, and marks.
- **Events & commands** — trace handler outcomes, nested calls, and explicitly named commands.
- **Decorations & node views** — inspect ranges, highlight positions, and follow lifecycle counters.
- **Performance** — compare dispatch, state-apply, view-update, and plugin-hook timings.
- **Plugins** — inspect plugin order, state, props, and the slowest plugin work.
- **Schema** — browse the editor's node and mark specifications.
- **Snapshots** — save and restore documents locally or move them as JSON.
- **Multiple editors** — register several `EditorView` instances and switch between them in one
  panel.

The same panel works in two ways:

- **Standalone**, rendered wherever it fits in your development UI.
- **Inside TanStack Devtools**, as a native plugin that follows the host theme and layout.

## Getting started

Install the package in an application that already uses ProseMirror:

```sh
npm install --save-dev prosemirror-devtools
```

Create a devtools session before you create the editor. Plugin instrumentation is optional, but it
is what makes per-plugin timings available.

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

Here, `schema` and `rawPlugins` are your existing editor configuration. Run this setup only in
development. If you do not need plugin timings, pass `rawPlugins` directly to `EditorState.create`
and attach the completed view.

### Show it as a standalone panel

This React example renders the panel directly in the application. Matching panel adapters are
available for Preact, Solid, Vue, Svelte, and Angular.

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

### Add it to TanStack Devtools

Install the TanStack Devtools package for your framework, then create a ProseMirror plugin for its
shell:

```sh
npm install --save-dev @tanstack/react-devtools
```

```tsx
import { TanStackDevtools } from "@tanstack/react-devtools";
import { createProseMirrorDevtoolsPlugin } from "prosemirror-devtools/react";

const prosemirrorDevtools = createProseMirrorDevtoolsPlugin({
  defaultOpen: false,
});

export function App() {
  return <TanStackDevtools plugins={[prosemirrorDevtools]} />;
}
```

Use `prosemirror-devtools/preact`, `/solid`, `/vue`, `/svelte`, or `/angular` with the
matching TanStack Devtools package.

## Integrations

ProseMirror Devtools works with ProseMirror directly and includes framework adapters for React,
Preact, Solid, Vue, Svelte, and Angular. A dedicated Tiptap 3 integration handles Tiptap's editor
lifecycle and transaction middleware.

For Tiptap setup, isolated stores, panel extensions, custom performance markers, and the complete
API reference, read the [package guide](./packages/prosemirror-devtools/README.md).

Events and rendering diagnostics are opt-in. Enable `diagnostics: true` or `{ limit: 200 }` on a
devtools session, then use its `instrumentPlugins` and `attach` methods. Capture is bounded
separately from transaction history. See the [diagnostics setup](./packages/prosemirror-devtools/README.md#optional-event-and-rendering-diagnostics)
and the [review and remaining follow-ups](./docs/devtools-review.md). Collaboration diagnostics are
deferred.

## Examples

The monorepo keeps one private example per framework so each adapter can be run and tested in its
native environment:

- [React](./packages/tanstack-devtools-demo)
- [Preact](./packages/preact-demo)
- [Solid](./packages/solid-demo)
- [Vue](./packages/vue-demo)
- [Svelte](./packages/svelte-demo)
- [Angular](./packages/angular-demo)

## License

[MIT](./LICENSE)
