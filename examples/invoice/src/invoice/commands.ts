import type { Editor } from "@tiptap/core";
import { Fragment } from "prosemirror-model";
import {
  AllSelection,
  NodeSelection,
  TextSelection,
  type EditorState,
  type Transaction,
} from "prosemirror-state";

import { tagDomainEvent, traceCommand } from "../devtools/session";
import {
  createLineItemId,
  findSection,
  lineItemRows,
  nodeNames,
  pages,
  readLineItem,
  rowsInRange,
  sections,
} from "./document";
import type { FieldKey } from "./fields";
import { generateLineItems, initialInvoice, lineItemPages } from "./fixture";
import { canTransition, cents, reprice, type InvoiceMeta, type InvoiceStatus } from "./model";
import { getFindState, setFindQuery } from "./plugins/find";
import { setValidationDelay } from "./plugins/validation";

type Build = (state: EditorState) => Transaction | null;

function run(editor: Editor, name: string, build: Build): boolean {
  return traceCommand(editor, name, () => {
    const tr = build(editor.state);
    if (!tr) return false;
    editor.view.dispatch(tr);
    return true;
  });
}

function selectedRows(state: EditorState) {
  return rowsInRange(state.doc, state.selection.from, state.selection.to);
}

export function addLineItem(editor: Editor): boolean {
  return run(editor, "Add line item", (state) => {
    const container = sections(state.doc).findLast(
      ({ node }) => node.type.name === nodeNames.lineItems,
    );
    if (!container) return null;
    const end = container.pos + container.node.nodeSize - 1;
    const row = state.schema.nodes[nodeNames.lineItem]!.create({
      id: createLineItemId(),
      quantity: 1,
      unitPrice: cents(0),
      vatRate: 22,
      discountPercent: 0,
    });
    const tr = state.tr.insert(end, row);
    return tr.setSelection(TextSelection.create(tr.doc, end + 1)).scrollIntoView();
  });
}

export function duplicateSelectedRows(editor: Editor): boolean {
  return run(editor, "Duplicate rows", (state) => {
    const rows = selectedRows(state);
    const last = rows.at(-1);
    if (!last) return null;
    return state.tr.insert(
      last.pos + last.node.nodeSize,
      Fragment.from(rows.map(({ node }) => node)),
    );
  });
}

export function deleteRows(editor: Editor, at?: number): boolean {
  return run(editor, "Delete rows", (state) => {
    const rows = at === undefined ? selectedRows(state) : rowsInRange(state.doc, at, at + 1);
    const first = rows[0];
    const last = rows.at(-1);
    if (!first || !last) return null;
    const container = state.doc.resolve(first.pos).parent;
    // Each lineItems section keeps a row, and one delete never merges two sections.
    if (container !== state.doc.resolve(last.pos).parent) return null;
    if (rows.length >= container.childCount) return null;
    return state.tr.delete(first.pos, last.pos + last.node.nodeSize);
  });
}

export function applyDiscountToAll(editor: Editor, percent: number): boolean {
  return run(editor, "Apply discount", (state) => {
    const tr = state.tr;
    const rows = lineItemRows(state.doc);
    for (const { pos } of rows) tr.setNodeAttribute(pos, "discountPercent", percent);
    return tagDomainEvent(tr, {
      label: "Discount applied",
      tone: "success",
      data: { percent, rows: rows.length },
    });
  });
}

export function repriceInOneTransaction(editor: Editor, percent: number): boolean {
  return run(editor, "Reprice rows (one transaction)", (state) => {
    const tr = state.tr;
    const rows = lineItemRows(state.doc);
    for (const { node, pos } of rows) {
      tr.setNodeAttribute(pos, "unitPrice", reprice(readLineItem(node), percent));
    }
    return tagDomainEvent(tr, {
      label: "Bulk reprice",
      data: { mode: "single transaction", rows: rows.length, percent },
    });
  });
}

export const repriceDispatchLimit = 200;

/** One dispatch per row costs a validation pass per row, so the comparison caps the row count. */
export function repriceRowByRow(editor: Editor, percent: number): boolean {
  return traceCommand(editor, "Reprice rows (one dispatch each)", () => {
    const rows = lineItemRows(editor.state.doc).slice(0, repriceDispatchLimit);
    for (const [index, { pos }] of rows.entries()) {
      const node = editor.state.doc.nodeAt(pos);
      if (!node) continue;
      const tr = editor.state.tr.setNodeAttribute(
        pos,
        "unitPrice",
        reprice(readLineItem(node), percent),
      );
      if (index === 0) {
        tagDomainEvent(tr, {
          label: "Bulk reprice",
          data: { mode: "one dispatch per row", rows: rows.length, percent },
        });
      }
      editor.view.dispatch(tr);
    }
    return rows.length > 0;
  });
}

export function setStatus(editor: Editor, next: InvoiceStatus): boolean {
  return run(editor, `Mark as ${next}`, (state) => {
    const meta = findSection(state.doc, nodeNames.meta);
    if (!meta) return null;
    const from = meta.node.attrs.status as InvoiceStatus;
    if (!canTransition(from, next)) return null;
    return tagDomainEvent(state.tr.setNodeAttribute(meta.pos, "status", next), {
      label: "Status changed",
      tone: next === "void" ? "warning" : "info",
      data: { from, to: next },
    });
  });
}

export function updateMeta(editor: Editor, attrs: Partial<Omit<InvoiceMeta, "status">>): boolean {
  return run(editor, "Edit invoice details", (state) => {
    const meta = findSection(state.doc, nodeNames.meta);
    if (!meta) return null;
    return state.tr.setNodeMarkup(meta.pos, undefined, { ...meta.node.attrs, ...attrs });
  });
}

export function insertField(editor: Editor, key: FieldKey): boolean {
  return run(editor, "Insert merge field", (state) => {
    const field = state.schema.nodes[nodeNames.field]!.create({ key });
    if (!state.selection.$from.parent.type.contentMatch.matchType(field.type)) return null;
    return state.tr.replaceSelectionWith(field, false).scrollIntoView();
  });
}

export function selectAllLineItems(editor: Editor): boolean {
  return run(editor, "Select all line items", (state) => {
    const rows = lineItemRows(state.doc);
    const first = rows[0];
    const last = rows.at(-1);
    if (!first || !last) return null;
    return state.tr.setSelection(
      TextSelection.create(state.doc, first.pos + 1, last.pos + last.node.nodeSize - 1),
    );
  });
}

export function selectFirstRow(editor: Editor): boolean {
  return run(editor, "Select first row", (state) => {
    const first = lineItemRows(state.doc)[0];
    return first
      ? state.tr.setSelection(NodeSelection.create(state.doc, first.pos)).scrollIntoView()
      : null;
  });
}

export function selectPage(editor: Editor, index: number): boolean {
  return run(editor, `Select page ${index + 1}`, (state) => {
    const page = pages(state.doc)[index];
    return page
      ? state.tr.setSelection(NodeSelection.create(state.doc, page.pos)).scrollIntoView()
      : null;
  });
}

/** From the last row of one line-item page into the first row of the next one. */
export function selectAcrossPages(editor: Editor): boolean {
  return run(editor, "Select across pages", (state) => {
    const rows = lineItemRows(state.doc);
    const pageOf = (pos: number) => state.doc.resolve(pos).index(0);
    const boundary = rows.findIndex(
      (row, index) => index > 0 && pageOf(row.pos) !== pageOf(rows[index - 1]!.pos),
    );
    const before = rows[boundary - 1];
    const after = rows[boundary];
    if (boundary < 1 || !before || !after) return null;
    const selection = TextSelection.create(
      state.doc,
      before.pos + 1,
      after.pos + after.node.nodeSize - 1,
    );
    return state.tr.setSelection(selection).scrollIntoView();
  });
}

export function selectEverything(editor: Editor): boolean {
  return run(editor, "Select all", (state) => state.tr.setSelection(new AllSelection(state.doc)));
}

export const stressRowsPerPage = 25;

export function loadStressInvoice(editor: Editor, count: number): boolean {
  return run(editor, "Load stress invoice", (state) => {
    const itemPages = pages(state.doc).filter(({ node }) => node.attrs.kind === "lineItems");
    const first = itemPages[0];
    const last = itemPages.at(-1);
    if (!first || !last) return null;
    const replacement = lineItemPages(generateLineItems(count, 25), stressRowsPerPage).map((json) =>
      state.schema.nodeFromJSON(json),
    );
    const tr = state.tr.replaceWith(first.pos, last.pos + last.node.nodeSize, replacement);
    return tagDomainEvent(tr, {
      label: "Stress invoice loaded",
      tone: "warning",
      data: { rows: count, pages: replacement.length, rowsPerPage: stressRowsPerPage },
    });
  });
}

export function setSlowPlugin(editor: Editor, delayMs: number): boolean {
  return run(editor, "Set validation delay", (state) =>
    tagDomainEvent(setValidationDelay(state.tr, delayMs), {
      label: "Slow plugin configured",
      tone: delayMs > 0 ? "warning" : "neutral",
      data: { delayMs },
    }),
  );
}

export function insertPageBreak(editor: Editor): boolean {
  return run(editor, "Insert page break", (state) => {
    const { $from } = state.selection;
    if ($from.depth < 2 || $from.index(1) === 0) return null;
    const splitAt = $from.before(2);
    const continued = [{ type: state.schema.nodes[nodeNames.page]!, attrs: { kind: "continued" } }];
    // canSplit refuses isolating parents, but both halves are non-empty here, so the split is valid.
    return tagDomainEvent(state.tr.split(splitAt, 1, continued).scrollIntoView(), {
      label: "Page break inserted",
      data: { page: $from.index(0) + 1 },
    });
  });
}

export function moveSectionToNextPage(editor: Editor): boolean {
  return run(editor, "Move section to next page", (state) => {
    const { $from } = state.selection;
    if ($from.depth < 2) return null;
    const page = $from.node(1);
    const section = $from.node(2);
    const sectionStart = $from.before(2);
    const pageEnd = $from.after(1);
    const tr = state.tr;
    if (state.doc.nodeAt(pageEnd)) {
      tr.insert(pageEnd + 1, section);
    } else {
      const pageType = state.schema.nodes[nodeNames.page]!;
      tr.insert(pageEnd, pageType.create({ kind: "continued" }, section));
    }
    // Insertion happens after the source, so the source range is still valid here.
    if (page.childCount === 1) tr.delete($from.before(1), pageEnd);
    else tr.delete(sectionStart, sectionStart + section.nodeSize);
    return tagDomainEvent(tr.scrollIntoView(), {
      label: "Section moved",
      data: { section: section.type.name, fromPage: $from.index(0) + 1 },
    });
  });
}

export function findQuery(editor: Editor, query: string): boolean {
  return run(editor, "Find", (state) => setFindQuery(state.tr, query));
}

export function findStep(editor: Editor, direction: 1 | -1): boolean {
  return run(editor, direction === 1 ? "Find next" : "Find previous", (state) => {
    const { matches } = getFindState(state);
    if (matches.length === 0) return null;
    const { from } = state.selection;
    const match =
      direction === 1
        ? (matches.find((candidate) => candidate.from > from) ?? matches[0])
        : (matches.findLast((candidate) => candidate.from < from) ?? matches.at(-1));
    if (!match) return null;
    return state.tr
      .setSelection(TextSelection.create(state.doc, match.from, match.to))
      .scrollIntoView();
  });
}

export function resetDocument(editor: Editor): boolean {
  return traceCommand(editor, "Reset document", () =>
    editor.commands.setContent(initialInvoice, { emitUpdate: true }),
  );
}

export function undo(editor: Editor): boolean {
  return traceCommand(editor, "Undo", () => editor.commands.undo());
}

export function redo(editor: Editor): boolean {
  return traceCommand(editor, "Redo", () => editor.commands.redo());
}

export function toggleMark(editor: Editor, mark: "bold" | "italic" | "strike"): boolean {
  return traceCommand(editor, `Toggle ${mark}`, () =>
    editor.chain().focus().toggleMark(mark).run(),
  );
}

export function addComment(editor: Editor, author: string): boolean {
  return traceCommand(editor, "Add comment", () =>
    editor
      .chain()
      .focus()
      .setMark("comment", { id: `c-${crypto.randomUUID().slice(0, 8)}`, author, resolved: false })
      .run(),
  );
}

export function resolveComment(editor: Editor): boolean {
  return traceCommand(editor, "Resolve comment", () =>
    editor
      .chain()
      .focus()
      .extendMarkRange("comment")
      .updateAttributes("comment", { resolved: true })
      .run(),
  );
}

export function selectRange(editor: Editor, from: number, to: number): boolean {
  return traceCommand(editor, "Select range", () =>
    editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run(),
  );
}

export function selectRow(editor: Editor, pos: number): boolean {
  return traceCommand(editor, "Select row", () =>
    editor.chain().focus().setNodeSelection(pos).run(),
  );
}
