# prosemirror-inspector

## 0.3.0

### Minor Changes

- 2a22974: Add new ways to read a document in the State panel and to find a node from the editor.

  - The new default **Boxes** view shows block nodes as nested boxes and inline content as a row of chips, each with its marks and range.
  - The **DOM** view replaces the **HTML** view. For the live editor it shows the rendered DOM and labels each element as a node with its before and after positions, a mark with the range it wraps, a widget, or something outside the document, such as NodeView chrome or a decoration wrapper. Every text node shows its range, and a legend explains the labels. When the panel shows a state that the editor does not render, the view shows the schema's HTML export without positions.
  - The toolbar node picker (⌖) outlines the node under the pointer in the editor. Click a node to inspect it in the State panel, or press Escape to cancel.
  - Hover a row in the Structure, Boxes, or DOM view to outline its node in the live editor.

- 91b76f2: `createHistoryInspector()` no longer needs the `history()` plugin. Without a `plugin` option it finds the installed history plugin in each state it reads, so Tiptap apps can register it in `onBeforeCreate`, before StarterKit's UndoRedo installs history. It reports `unsupported` when no history plugin is installed. Passing `{ plugin }` still inspects that specific instance.
- 62dbafa: Group the panel tabs into sections. The top row shows Document, Timeline, Snapshots, Performance, Plugins and Context, followed by one section for each extension panel. Document (State, Selection, Schema), Timeline (Transactions, Events) and Plugins (Plugins, Rendering) show their panels in a second row, and selecting a section reopens the panel last used in it. Panel IDs, `defaultPanel`, `activePanel` and `onActivePanelChange` are unchanged and still use panel IDs. The transaction count moves to the Timeline section tab.
- 2fdf3a8: Rework the Selection panel around readable fields instead of JSON.

  - The selection shows its type, range, direction, selected node and active marks, and says where the marks come from: stored marks, the cursor, or the whole selection.
  - Each endpoint has its own card, or a single **Cursor** card for an empty selection, with its path, parent, offset, the nodes before and after it, and its marks. The Anchor / Head switch and the ancestors table are removed.
  - Type a position in **Resolve** to inspect any position in the document.
  - Click a node to inspect it in the State panel.

- bec1680: Add `prosemirror-inspector/standalone/production` and `prosemirror-inspector/recordings-panel/production`. They mount the standalone panel and the read-only recording viewer in production builds too, as the `<framework>/production` entries already do for the framework adapters. The default entries still render nothing outside development.
- 2fdf3a8: Make Timeline transactions readable at a glance.

  - Each dispatch is described by what it did, such as `insert "x" at 92`, `split paragraph at 3`, `add mark strong 66–78` or `select cursor 92`, in the list and in the detail header.
  - The detail shows the selection before and after, then one section per transaction, the root one and each one appended by a plugin, with its steps in words and its metadata. Step JSON remains available on demand.
  - **Document changes** replaces the full before and after documents with a diff of the changed nodes. Unchanged nodes are folded, and changed text, attributes and marks highlight the characters that differ.
  - Phase timings are no longer repeated in the Timeline: each dispatch shows its total duration and links to the Performance panel.

- 66cdce7: Add `createTiptapDevtoolsHooks` so a Tiptap extension wires the inspector by spreading four hooks into `Extension.create`. The package no longer depends on `@tiptap/core`, not even as an optional peer: `createTiptapInspector` reads the editor structurally. `setupTiptapDevtools` accepts `diagnostics: true` or diagnostics options, creates the controller, and disposes it on detach.
- 1c74c39: `createYjsInspector` labels which dispatch is a remote Yjs change. Pass the binding's `syncPluginKey`, such as `ySyncPluginKey` from `y-prosemirror` or `@tiptap/y-tiptap`, and each captured dispatch carries `dispatchOrigin`: `local`, `remote-yjs`, `yjs-undo-redo`, `yjs-local-transaction`, `yjs-render` or `yjs-snapshot`, for the root transaction and each appended one. The Timeline shows `Remote · Yjs` on dispatches the binding applied from a remote update. Without the key, `dispatchOrigin` is `unobserved` and the panel keeps the sampled update text.

### Patch Changes

- 842df4a: Attach-only sessions now explain missing handler evidence. When diagnostics are enabled but no plugins were passed through `session.instrumentPlugins`, the `events`, `decorations` and `nodeViews` capabilities and queries report `unobserved` with that reason instead of looking available or empty. An `events` read with traced commands adds a coverage note, and the Context and Events panels show the limitation. The diagnostics snapshot exposes `instrumentation`.
- 2c6725e: `evaluateProseMirrorInspection` and `prosemirror_check` now explain a path that does not resolve, naming the first missing segment, instead of reporting it as a value mismatch. The skills documentation describes installing the shipped skills through pnpm 12 approval or the `skills` CLI.
- dec05a3: Panel: every empty list, pane and loading state now uses one centered empty-state component; list and detail splits open the list at 40% of the panel width; dispatch rows keep their step and duration metadata readable; the Selection ancestors table scrolls instead of cutting header labels; the Context heading uses the 13px title step; recurring inline styles moved to panel classes.
- 4a3630b: Panel text is at least 10px, except labels inside charts. Read-out sections in Plugins, Rendering, Schema and Context no longer stack grey bands with empty gaps: notes sit on the section body and host `section` margins no longer leak in. Disclosures such as "Coverage and read point", "Related evidence" and "Raw effect samples" share one style.
- be4ee9c: Panel styles follow the design guide's tokens. Radii use a 4 / 6 / 8px scale, and the default `--prosemirror-devtools-radius` changes from 7px to 6px. Font weights are 500, 650 or 700. View switches share one `ViewSwitch` component, every button has its own class, and component font and color rules on buttons now apply instead of being overridden by a global `font: inherit` (for example tab labels use their 650 weight). Event status and coverage badges use sentence case.
- a0ec8a2: The panel keeps its layout when the host page styles elements globally, for example `button { height: 28px }` or `* { line-height: 1 }`. Timeline rows, tab labels and controls no longer clip or change size in such hosts.
- 417d6dc: Selected rows use one style in every panel: a flat accent background with the title in the accent color, without the left bar. Panel buttons, inputs and selects no longer inherit host styles such as a global `border-radius`.
- 7480102: The Performance tab no longer slows typing. Plugin hook timings recorded outside a dispatch now notify store subscribers once per microtask instead of once per plugin, and dispatches still publish synchronously. The Performance tab renders store changes when the browser is idle, within 100 ms.
- 8b2a0ef: The Rendering panel now records Tiptap node views. Tiptap 3 passes node views from `addNodeView`, including `ReactNodeViewRenderer`, to the EditorView directly rather than through a plugin, so they were never observed. `setupTiptapDevtools` now instruments them with the same create, update and destroy records as plugin node views, listed under the "Tiptap node views" source. `instrumentPlugins: false` turns this off too.
- 5322402: The WebMCP panel separates the call history from the available tools. The call history shows each call's source (native WebMCP or Chrome DevTools MCP) and the result kind returned by the tool, such as `expired` or `inconclusive`, and the selected call's input, result and reason in a detail pane. Available tools lists native WebMCP registrations and the tools offered to Chrome DevTools MCP, including when an MCP client discovered them. `installProseMirrorChromeBridge` reports its tools to the WebMCP inspector passed as `inspector`.

## 0.2.0

### Minor Changes

- c2e1f19: Add an opt-in WebMCP panel that lists registered ProseMirror tools and records their calls. Connect native WebMCP and Chrome DevTools MCP calls to the same history and show a live tool call in the standalone demo.

### Patch Changes

- 960faed: Update the TanStack Devtools and framework dependencies. Adapt the Svelte panel to the new mount and cleanup API, and migrate the Performance graphs to TanStack Charts 1.5.

## 0.1.0

### Minor Changes

- 1db65c9: Add read-only agent tools, semantic checks with explicit evidence requirements, experimental Chrome discovery, and three versioned agent skills with real integration fixtures.
- 4a3d144: Add explicit inspection targets, coherent bounded queries, capture gaps, semantic history and collaboration providers, native editor recorders, and diagnostic recordings.
- acafcdd: Add host-local historical navigation, contextual document inspection, checkpoint comparison, and a separate read-only recording viewer.
- 21e6e13: Add native WebMCP registration for the shared read-only inspection tools. Restore the compact live header and move diagnostic details to a separate Context panel. Group related dispatch links to keep transaction details visible.

## 0.0.2

### Patch Changes

- cd09438: Preserve plugin subclass prototypes during instrumentation so `instanceof` checks and custom fields, accessors, and methods continue to work, including methods that use private fields.

## 0.0.1

### Patch Changes

- dc13c96: Refresh the package documentation with a shorter getting-started flow, clear standalone and
  TanStack Devtools hosting paths, and focused framework, Tiptap, feature, and API guidance.
- 05d745e: Expose UI-independent plugin timing aggregation and related types from the new
  `prosemirror-inspector/performance` feature entrypoint.

  Add dependency-free `prosemirror-inspector/tiptap` lifecycle helpers that instrument Tiptap's
  generated ProseMirror plugins, register its view, record through Tiptap 3's native transaction
  middleware, and clean up from an application-owned Tiptap extension.

  Add development-safe TanStack Devtools adapters for React, Preact, Solid, Vue, Svelte, and Angular,
  with explicit production entrypoints.

  Move the built-in panel and TanStack Charts renderer from React to Solid 1 while preserving the
  framework-neutral adapter and extension contracts.

  Compile the panel through CSS Modules, expose inherited and typed theme variables plus explicit
  styles entrypoints, and adapt framework-neutral store readables to owner-scoped Solid signals.

  Replace the stateful registry API with a functional devtools store, granular subscriptions, lazy
  transaction detail serialization, versioned local snapshots, and a container-responsive panel.

- 488a2a7: Add Selection, Events & Commands, and Decorations & NodeViews panels, plus step diffs and
  position mapping in History. Provide bounded, opt-in diagnostic capture with session,
  framework, and Tiptap integration.

  Improve embedded layouts, keyboard navigation, lazy JSON inspection, recorder lifecycle
  isolation, adapter updates and teardown, and snapshot import ownership checks.

  Add `prosemirror-transform` as a required peer dependency for recorded position mapping.
