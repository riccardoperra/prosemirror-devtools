# Invoice workbench

A long, structured Tiptap 3 document for battle-testing the inspector: a multi-page invoice
dossier with node views, decorations, plugin state, custom markers, and named load scenarios.

Run `pnpm build:package`, then `pnpm --filter @prosemirror-devtools/invoice-demo dev` and open
port 4184. Press ⌘⇧D (Ctrl+Shift+D) to open TanStack Devtools.

## The document

`doc` holds `page+`. Each page is a node whose header and footer come from a React node view: the
invoice number and "Page n of N" are computed from the page's position, never stored. Pages hold
sections:

- a cover with the invoice header and the two parties;
- 65 line items over three pages, with totals closing the last one;
- a timesheet appendix that groups hours by project;
- a payment schedule whose installments are derived from the totals;
- terms and notes with headings, lists, a blockquote, merge fields, and a comment;
- a signatures block with signature atoms.

Pagination is explicit. **Page break**, under **More** in the toolbar, splits the current page before the section that holds the
caret, and **Move section to next page** moves that section. There is no automatic reflow, so a page
can grow past its printed height.

The domain model in `src/invoice/model.ts` has no editor imports. Money is integer cents, status
changes go through a transition table, totals and installments are always derived, and paid or void
invoices are read-only.

## Outline

The left sidebar opens with an outline of the document from `readOutline` in
`src/invoice/outline.ts`: every page, and inside it the invoice sections and headings, with badges
for invalid rows and open comments. Clicking an entry selects it, focuses the editor, and scrolls it
into view under a spotlight decoration. The spotlight stays visible when the invoice is paid and
the editor cannot take focus. The entry that holds the selection is highlighted.

The outline is computed once per document, and each block's counts are cached per node, so a
keystroke in a 2,000-row invoice recomputes one section.

## Scenarios

The left panel lists named scenarios from `src/scenarios.ts`. Each one runs a command and says which
inspector panel to open and what to look for. They cover node, cross-page, and all selections, id
normalization in an appended transaction, a slow plugin, a decoration flood, one bulk transaction
against many dispatches, undoing a bulk edit, comments, the status that flips editability,
mounting 1,000 node views, page breaks, and the plugin state inspector.

The collapsible load lab under the scenarios has the knobs: a 300 to 2,000 row stress invoice, a busy-wait delay
for the validation plugin, and a 5% reprice either in one transaction or as one dispatch per row
(capped at 200 rows).

Every toolbar command runs through `diagnostics.traceCommand`. Validation, search, and id
normalization run inside `measureProseMirrorDevtools`, and markers report row, decoration, and
delay counts. `createTiptapInspector` declares the plugin associations, and
`createPluginStateInspector` projects the validation state.

## Every inspector capability

The devtools shell in `src/devtools/shell.tsx` loads through a dynamic import, so a production
build without the showcase flag ships none of it. It wires:

- the **WebMCP** tab from `createProseMirrorWebMcpInspector`, passed to both
  `installProseMirrorChromeBridge` and `installProseMirrorWebMCPBridge`. The "Agent reads the
  invoice" scenario dispatches the Chrome DevTools MCP discovery event and calls three tools, so the
  tab shows real calls without a connected agent;
- `createHistoryInspector()`, which finds the `history()` plugin Tiptap installs after setup.
  Transactions show undo and redo depths for each dispatch;
- `performanceExtension: true`, so a Chrome Performance recording with **Show custom tracks**
  shows dispatches, phases, plugin hooks, and markers as tracks;
- snapshots through `createSnapshot` and `persistSnapshots`: the snapshot scenario saves one before
  a bulk reprice, and the Snapshots tab can preview and restore it;
- recordings: **More › Export recording** downloads `exportProseMirrorRecording` output, and **More ›
  Open recording** parses a file and shows it in a read-only viewer. The viewer renders the
  `RecordingInspector` component from `/recordings-panel` in a dialog.
  `mountProseMirrorRecordingInspector` is inert outside development, and the Pages showcase is a
  production build.

## Two tabs, two users

Add `?room=<id>&user=<name>` to collaborate through Yjs, or pick **More › Collaborate in two
tabs**. **Open as second user** opens the same room in a new tab under another name and color.

The transport is `src/collab/broadcast-provider.ts`, a BroadcastChannel provider. It only reaches
tabs of the same browser and origin, which also holds on GitHub Pages. A joining tab sends its state
vector and receives what it lacks, and awareness carries names, colors, carets, and selections.
Only the first peer of an empty room seeds the fixture.

In a room, `@tiptap/extension-collaboration` replaces prosemirror-history, so undo, redo, and the
"Undo a bulk edit" scenario use the Yjs undo manager. `@tiptap/extension-collaboration-caret`
draws remote carets. The id normalizer derives a duplicate's new id from the document alone, so
peers never overwrite each other's ids, and editability still follows the shared status. The
inspector adds `createYjsInspector` and a `createTransportObserver` fed by the provider, and the
Invoice tab adds a Collaboration section with peers, last sync, and bytes sent and received.

## The Invoice tab

The inspector gets an **Invoice** tab from `src/devtools/InvoicePanel.tsx`, a React panel extension.
It renders one pure selector, `readInvoiceDebugState` in `src/devtools/debug-state.ts`: the status
and its allowed transitions, editability, page and row counts, totals, every comment mark, the
validation issues grouped by rule, and the find query. Clicking a comment or an invalid row selects
it in the editor. The domain events list shows the last 50 markers and measures the example
emitted, kept in a ring buffer in `src/devtools/session.ts` next to the code that reports them.

The bubble menu is registered by `@tiptap/react` with `registerPlugin` after the editor is
created, so its plugin hooks are outside instrumentation coverage.

## The GitHub Pages showcase

`src/env.ts` holds the one diagnostics flag: development, or a build with `VITE_SHOWCASE=true`.
The shell then imports `createProseMirrorDevtoolsPlugin` from
`prosemirror-inspector/react/production`, because the default React entry renders nothing outside
development.

`pnpm build:pages` at the root builds the package, builds every example in
`scripts/examples.mjs` (this one under `/prosemirror-devtools/invoice/`), and assembles `pages-dist/` with the landing page from `site/`
at its root. `pnpm preview:pages` serves `pages-dist` under the same base on port 4300.
`.github/workflows/pages.yml` runs the build and deploys it on pushes to `main`.
