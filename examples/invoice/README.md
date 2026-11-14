# Invoice workbench

A realistic Tiptap 3 document used to battle-test the inspector. The invoice is a structured
schema, not a table: `invoiceMeta parties lineItems totals block*`.

Run `pnpm build:package`, then `pnpm --filter @prosemirror-devtools/invoice-demo dev` and open
port 4184. Press ⌘⇧D (Ctrl+Shift+D) to open TanStack Devtools.

What it exercises:

- React node views with inputs for the invoice header, line items, totals, and merge-field chips.
- An `appendTransaction` normalizer that gives duplicated or pasted rows a fresh id.
- Validation decorations (node classes and a widget) recomputed only when the document changes.
- A find plugin with inline decorations and a text selection that steps through matches.
- An active-row node decoration and a custom `comment` mark with a sidebar and bubble menu.
- Editability derived from the invoice status. Paid and void invoices are read-only.
- `traceCommand` around every toolbar command, `measureProseMirrorDevtools` spans around
  normalization, validation, and search, and `markProseMirrorDevtools` markers for status
  changes, discounts, and the 300-row stress load.
- `createTiptapInspector` with declared plugin associations and a `createPluginStateInspector`
  projection of the validation state.

The domain model in `src/invoice/model.ts` has no editor imports. Money is integer cents, status
changes go through a transition table, and totals are always derived from the document.

The bubble menu is registered by `@tiptap/react` with `registerPlugin` after the editor
is created, so its plugin hooks are outside instrumentation coverage.
