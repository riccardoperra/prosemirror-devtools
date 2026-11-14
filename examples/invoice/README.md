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

## Scenarios

The left panel lists named scenarios from `src/scenarios.ts`. Each one runs a command and says which
inspector panel to open and what to look for. They cover node, cross-page, and all selections, id
normalization in an appended transaction, a slow plugin, a decoration flood, one bulk transaction
against many dispatches, undoing a bulk edit, comments, the status that flips editability,
NodeView lifecycles under load, page breaks, and the plugin state inspector.

The collapsible load lab under the scenarios has the knobs: a 300 to 2,000 row stress invoice, a busy-wait delay
for the validation plugin, and a 5% reprice either in one transaction or as one dispatch per row
(capped at 200 rows).

Every toolbar command runs through `diagnostics.traceCommand`. Validation, search, and id
normalization run inside `measureProseMirrorDevtools`, and markers report row, decoration, and
delay counts. `createTiptapInspector` declares the plugin associations, and
`createPluginStateInspector` projects the validation state.

The bubble menu is registered by `@tiptap/react` with `registerPlugin` after the editor is
created, so its plugin hooks are outside instrumentation coverage.
