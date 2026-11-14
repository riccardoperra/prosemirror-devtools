import type { Editor } from "@tiptap/core";

import {
  addComment,
  addLineItem,
  applyDiscountToAll,
  duplicateSelectedRows,
  findQuery,
  insertPageBreak,
  loadStressInvoice,
  moveSectionToNextPage,
  repriceDispatchLimit,
  repriceInOneTransaction,
  repriceRowByRow,
  resolveComment,
  selectAcrossPages,
  selectEverything,
  selectFirstRow,
  selectPage,
  selectRange,
  setSlowPlugin,
  setStatus,
  undo,
} from "./invoice/commands";
import { findSection, nodeNames, pages, readMeta } from "./invoice/document";

/** Visible names of the inspector panels, as the tabs label them. */
export type InspectorPanel =
  | "State"
  | "Selection"
  | "Transactions"
  | "Events & commands"
  | "Performance"
  | "Plugins"
  | "Rendering"
  | "Context"
  | "Invoice";

/** The inspector groups panels under top-level section tabs. */
export const panelSections: Record<InspectorPanel, string> = {
  State: "Document",
  Selection: "Document",
  Transactions: "Timeline",
  "Events & commands": "Timeline",
  Performance: "Performance",
  Plugins: "Plugins",
  Rendering: "Plugins",
  Context: "Context",
  Invoice: "Invoice",
};

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  run(editor: Editor): boolean;
  /** Where to look, best place first. */
  readonly inspect: readonly { readonly panel: InspectorPanel; readonly observe: string }[];
}

function selectSellerName(editor: Editor): boolean {
  const parties = findSection(editor.state.doc, nodeNames.parties);
  const name = parties?.node.firstChild?.firstChild;
  if (!parties || !name) return false;
  const start = parties.pos + 3;
  return selectRange(editor, start, start + name.content.size);
}

/** The cover's introduction paragraph is the last section of page 1. */
function caretInCoverIntro(editor: Editor): boolean {
  const cover = pages(editor.state.doc)[0];
  const intro = cover?.node.lastChild;
  if (!cover || !intro?.isTextblock) return false;
  const end = cover.pos + cover.node.nodeSize - 2;
  return selectRange(editor, end, end);
}

function caretInHeading(editor: Editor, text: string): boolean {
  let target: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (target !== null) return false;
    if (node.type.name === "heading" && node.textContent === text) target = pos + node.nodeSize - 1;
    return !node.isTextblock;
  });
  return target !== null && selectRange(editor, target, target);
}

export const scenarios: readonly Scenario[] = [
  {
    id: "row-node-selection",
    title: "Select a row as a node",
    description: "Creates a NodeSelection around the first line item.",
    run: selectFirstRow,
    inspect: [
      {
        panel: "Selection",
        observe:
          "A node selection whose node is lineItem, with the lineItems section as its parent.",
      },
    ],
  },
  {
    id: "page-node-selection",
    title: "Select a whole page",
    description: "Creates a NodeSelection around page 2.",
    run: (editor) => selectPage(editor, 1),
    inspect: [
      {
        panel: "Selection",
        observe: "The selected node is a page at depth 0, so from and to are top-level positions.",
      },
    ],
  },
  {
    id: "cross-page-selection",
    title: "Select across a page boundary",
    description: "A TextSelection from the last row of one page into the first row of the next.",
    run: selectAcrossPages,
    inspect: [
      {
        panel: "Selection",
        observe: "Anchor and head resolve into different page ancestors.",
      },
    ],
  },
  {
    id: "all-selection",
    title: "Select everything",
    description: "An AllSelection over every page.",
    run: selectEverything,
    inspect: [
      { panel: "Selection", observe: "The selection type is all, from 0 to the doc size." },
    ],
  },
  {
    id: "duplicate-normalize",
    title: "Duplicate a row",
    description: "Copies the first row, then the id normalizer rewrites the duplicate id.",
    run: (editor) => selectFirstRow(editor) && duplicateSelectedRows(editor),
    inspect: [
      {
        panel: "Transactions",
        observe:
          "A root transaction followed by an appended one from lineItemIds that sets a new id.",
      },
    ],
  },
  {
    id: "slow-plugin",
    title: "Slow validation plugin",
    description: "Makes every validation recompute busy-wait 40 ms, then recomputes once.",
    run: (editor) => setSlowPlugin(editor, 40),
    inspect: [
      {
        panel: "Performance",
        observe:
          "lineItemValidation's apply hook tops the plugin ranking, next to a Validation marker.",
      },
    ],
  },
  {
    id: "decoration-flood",
    title: "Decoration flood",
    description:
      "Searches for the letter e. After NodeViews under load, that is thousands of inline decorations.",
    run: (editor) => findQuery(editor, "e"),
    inspect: [
      {
        panel: "Rendering",
        observe: "The find plugin's decoration source with thousands of inline ranges.",
      },
    ],
  },
  {
    id: "bulk-single",
    title: "Reprice in one transaction",
    description: "Raises every unit price by 5% with a single dispatch.",
    run: (editor) => repriceInOneTransaction(editor, 5),
    inspect: [
      {
        panel: "Performance",
        observe: "One dispatch with a Bulk reprice marker that reports the row count.",
      },
    ],
  },
  {
    id: "bulk-many",
    title: "Reprice row by row",
    description: `Raises up to ${repriceDispatchLimit} unit prices by 5% with one dispatch per row.`,
    run: (editor) => repriceRowByRow(editor, 5),
    inspect: [
      {
        panel: "Performance",
        observe:
          "Dozens of dispatches, each paying for validation. Compare the total with one transaction.",
      },
    ],
  },
  {
    id: "undo-bulk",
    title: "Undo a bulk edit",
    description: "Reprices every row in one transaction, then undoes it.",
    run: (editor) => repriceInOneTransaction(editor, 5) && undo(editor),
    inspect: [
      {
        panel: "Transactions",
        observe: "The undo dispatch restores every unitPrice attribute in a single history step.",
      },
    ],
  },
  {
    id: "comment",
    title: "Comment, then resolve",
    description: "Adds a comment mark to the seller name and resolves it.",
    run: (editor) =>
      selectSellerName(editor) && addComment(editor, "Reviewer") && resolveComment(editor),
    inspect: [
      {
        panel: "Invoice",
        observe: "The Reviewer comment on the seller name, resolved, with its range.",
      },
      {
        panel: "Events & commands",
        observe:
          "Traced Select range, Add comment and Resolve comment commands, each with its dispatch.",
      },
    ],
  },
  {
    id: "status-paid",
    title: "Mark the invoice paid",
    description: "Moves draft to sent to paid. Paid invoices are read-only.",
    run: (editor) => {
      if (readMeta(editor.state.doc).status === "draft") setStatus(editor, "sent");
      return setStatus(editor, "paid");
    },
    inspect: [
      {
        panel: "Plugins",
        observe: "invoiceReadOnly exposes the editable prop, which now resolves to false.",
      },
    ],
  },
  {
    id: "nodeview-stress",
    title: "NodeViews under load",
    description: "Replaces the line items with 1,000 generated rows on 40 pages.",
    run: (editor) => loadStressInvoice(editor, 1000),
    inspect: [
      {
        panel: "Rendering",
        observe:
          "NodeView lifecycle counters: about 1,000 lineItem views created and the old ones destroyed.",
      },
    ],
  },
  {
    id: "domain-marker",
    title: "Apply a 10% discount",
    description: "Sets the discount on every row in one transaction.",
    run: (editor) => applyDiscountToAll(editor, 10),
    inspect: [
      {
        panel: "Performance",
        observe:
          "A Discount applied marker with percent and rows, beside the Validate line items span.",
      },
    ],
  },
  {
    id: "page-break",
    title: "Insert a page break",
    description: "Splits the cover page before its introduction paragraph.",
    run: (editor) => caretInCoverIntro(editor) && insertPageBreak(editor),
    inspect: [
      {
        panel: "State",
        observe: "A new continued page after the cover. Every footer renumbers from its position.",
      },
    ],
  },
  {
    id: "move-section",
    title: "Move a section to the next page",
    description: "Moves the Notes heading from the terms page to the top of the next page.",
    run: (editor) => caretInHeading(editor, "Notes") && moveSectionToNextPage(editor),
    inspect: [
      {
        panel: "Transactions",
        observe:
          "One transaction with an insert into the next page and a delete from the terms page.",
      },
    ],
  },
  {
    id: "validation-inspector",
    title: "Add an invalid row",
    description: "Adds an empty row, which fails the description rule.",
    run: addLineItem,
    inspect: [
      {
        panel: "Invoice",
        observe: "Validation lists the new row under description-required. Click it to select it.",
      },
      {
        panel: "Context",
        observe:
          "Under Technical details, the invoice-validation projection counts one more invalid row.",
      },
    ],
  },
];
