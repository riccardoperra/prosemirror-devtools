import type { Editor } from "@tiptap/core";

import { collabUrl, nextFreeUser } from "./collab/config";
import type { CollabSession } from "./collab/session";
import type { DevtoolsActions } from "./devtools/context";
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

/** Visible names of the inspector panels, as the tabs label them, plus two viewers outside it. */
export type InspectorPanel =
  | "State"
  | "Selection"
  | "Transactions"
  | "Events & commands"
  | "Performance"
  | "Plugins"
  | "Rendering"
  | "Snapshots"
  | "Context"
  | "Invoice"
  | "WebMCP"
  | "Recording viewer"
  | "Chrome Performance panel";

/** The inspector groups panels under top-level section tabs. */
export const panelSections: Record<InspectorPanel, string> = {
  State: "Document",
  Selection: "Document",
  Transactions: "Timeline",
  "Events & commands": "Timeline",
  Performance: "Performance",
  Plugins: "Plugins",
  Rendering: "Plugins",
  Snapshots: "Snapshots",
  Context: "Context",
  Invoice: "Invoice",
  WebMCP: "WebMCP",
  "Recording viewer": "Recording viewer",
  "Chrome Performance panel": "Chrome Performance panel",
};

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Listed only in that mode. Without it, the scenario runs in both. */
  readonly mode?: "solo" | "room";
  /**
   * Scenarios that need diagnostics get the devtools shell's actions, or null when it is off.
   * Room scenarios get the collaboration session, which is null under `?solo`.
   */
  run(
    editor: Editor,
    devtools: DevtoolsActions | null,
    collab: CollabSession | null,
  ): boolean | Promise<boolean>;
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
        panel: "Performance",
        observe:
          "One dispatch whose view update dominates while React mounts about 1,000 row node views.",
      },
      {
        panel: "Rendering",
        observe:
          "Node views stay at 0: Tiptap passes node views to the view, not through a plugin, so they are not instrumented.",
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
  {
    id: "agent-reads",
    title: "Agent reads the invoice",
    description:
      "Discovers the inspection tools like Chrome DevTools MCP, lists editors, reads the selection, and checks it.",
    run: async (_editor, devtools) => (devtools ? devtools.askAgent() : false),
    inspect: [
      {
        panel: "WebMCP",
        observe:
          "Three Chrome DevTools MCP calls: prosemirror_editors, prosemirror_inspect, and a passed prosemirror_check.",
      },
    ],
  },
  {
    id: "second-user",
    title: "Open a second user",
    mode: "room",
    description: "Opens this room in a new tab as the next free user.",
    run: (_editor, _devtools, collab) => {
      if (!collab) return false;
      const taken = collab.getSnapshot().peers.map((peer) => peer.name);
      const url = collabUrl(location.href, collab.config.room, nextFreeUser(taken).name);
      return window.open(url, "_blank") !== null;
    },
    inspect: [
      {
        panel: "Invoice",
        observe:
          "Collaboration lists both users with their color, local or remote, and cursor position.",
      },
      {
        panel: "Plugins",
        observe:
          "y-sync$, y-undo$ and yjs-cursor$ are installed. In Context › Technical details, the tiptap evidence maps them to collaboration and collaborationCaret.",
      },
    ],
  },
  {
    id: "remote-edit",
    title: "Watch a remote edit",
    mode: "room",
    description:
      "A bot joins the room as a second Yjs client, appends “(edited remotely)” to the first row, and leaves.",
    run: async (_editor, _devtools, collab) =>
      collab ? (await import("./collab/remote-peer")).simulateRemoteEdit(collab) : false,
    inspect: [
      {
        panel: "Transactions",
        observe:
          "The replace dispatch that adds the text reads “Remote · Yjs · Update applied”. Its detail shows the dispatch origin: the binding applied a Y.Doc update from another client. Your own edits carry no Yjs label in the list.",
      },
      {
        panel: "Context",
        observe:
          "Under Technical details › Semantic inspector evidence › yjs, latestUpdate.local is false: the last Y.Doc update came from the bot. latestTransaction turns local again on the next dispatch, because y-sync opens a Yjs transaction for each one.",
      },
    ],
  },
  {
    id: "undo-history",
    mode: "solo",
    title: "Undo history depth",
    description: "Applies a 10% discount, then undoes it.",
    run: (editor) => applyDiscountToAll(editor, 10) && undo(editor),
    inspect: [
      {
        panel: "Transactions",
        observe:
          "The undo dispatch's Undo history detail: undo depth drops by one and redo depth rises by one.",
      },
      {
        panel: "Context",
        observe: "Undo history is listed among the installed inspectors.",
      },
    ],
  },
  {
    id: "snapshot-restore",
    title: "Snapshot before a bulk edit",
    description: "Saves a snapshot named Before reprice, then raises every unit price by 5%.",
    run: (editor, devtools) => {
      if (!devtools) return false;
      devtools.takeSnapshot(editor, "Before reprice");
      return repriceInOneTransaction(editor, 5);
    },
    inspect: [
      {
        panel: "Snapshots",
        observe:
          "Before reprice is listed. Restore previews the difference, then puts the old prices back in one transaction.",
      },
    ],
  },
  {
    id: "recording",
    title: "Share a recording",
    description:
      "Exports the latest 25 dispatches as a bounded recording and opens it in the read-only viewer. Run an editing scenario first.",
    run: (_editor, devtools) => (devtools ? devtools.previewRecording() : false),
    inspect: [
      {
        panel: "Recording viewer",
        observe:
          "The document, selection, and dispatches read offline from the file. More › Export recording downloads one, and More › Open recording loads it back.",
      },
    ],
  },
  {
    id: "performance-tracks",
    title: "Chrome Performance tracks",
    description:
      "Record in Chrome's Performance panel with Show custom tracks on, then run Reprice row by row.",
    run: (editor) => repriceRowByRow(editor, 5),
    inspect: [
      {
        panel: "Chrome Performance panel",
        observe:
          "ProseMirror tracks beside the main thread: each dispatch, its phases, plugin hooks, and the Bulk reprice marker.",
      },
    ],
  },
];
