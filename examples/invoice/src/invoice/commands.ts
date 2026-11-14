import type { Editor } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "prosemirror-model";
import { TextSelection, type EditorState, type Transaction } from "prosemirror-state";

import { tagDomainEvent, traceCommand } from "../devtools/session";
import {
  createLineItemId,
  findLineItems,
  lineItemRows,
  nodeNames,
  readMeta,
  rowsInRange,
} from "./document";
import type { FieldKey } from "./fields";
import { stressLineItems } from "./fixture";
import { canTransition, cents, type InvoiceMeta, type InvoiceStatus } from "./model";
import { getFindState, setFindQuery } from "./plugins/find";

type Build = (state: EditorState) => Transaction | null;

function run(editor: Editor, name: string, build: Build): boolean {
  return traceCommand(editor, name, () => {
    const tr = build(editor.state);
    if (!tr) return false;
    editor.view.dispatch(tr);
    return true;
  });
}

function newLineItem(state: EditorState): ProseMirrorNode {
  return state.schema.nodes[nodeNames.lineItem]!.create({
    id: createLineItemId(),
    quantity: 1,
    unitPrice: cents(0),
    vatRate: 22,
    discountPercent: 0,
  });
}

function selectedRows(state: EditorState) {
  return rowsInRange(state.doc, state.selection.from, state.selection.to);
}

export function addLineItem(editor: Editor): boolean {
  return run(editor, "Add line item", (state) => {
    const { node, pos } = findLineItems(state.doc);
    const end = pos + node.nodeSize - 1;
    const tr = state.tr.insert(end, newLineItem(state));
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
    // The schema requires at least one line item.
    if (!first || !last || rows.length >= lineItemRows(state.doc).length) return null;
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

export function setStatus(editor: Editor, next: InvoiceStatus): boolean {
  return run(editor, `Mark as ${next}`, (state) => {
    const from = readMeta(state.doc).status;
    if (!canTransition(from, next)) return null;
    return tagDomainEvent(state.tr.setNodeAttribute(0, "status", next), {
      label: "Status changed",
      tone: next === "void" ? "warning" : "info",
      data: { from, to: next },
    });
  });
}

export function updateMeta(editor: Editor, attrs: Partial<Omit<InvoiceMeta, "status">>): boolean {
  return run(editor, "Edit invoice details", (state) =>
    state.tr.setNodeMarkup(0, undefined, { ...state.doc.child(0).attrs, ...attrs }),
  );
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

export function loadStressInvoice(editor: Editor, count: number): boolean {
  return run(editor, "Load stress invoice", (state) => {
    const { node, pos } = findLineItems(state.doc);
    const rows = stressLineItems(count).map(({ description, ...attrs }) =>
      state.schema.nodes[nodeNames.lineItem]!.create(attrs, state.schema.text(description)),
    );
    const tr = state.tr.replaceWith(pos + 1, pos + node.nodeSize - 1, rows);
    return tagDomainEvent(tr, {
      label: "Stress invoice loaded",
      tone: "warning",
      data: { rows: count },
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
  return traceCommand(editor, "Select comment", () =>
    editor.chain().focus().setTextSelection({ from, to }).scrollIntoView().run(),
  );
}

export function selectRow(editor: Editor, pos: number): boolean {
  return traceCommand(editor, "Select row", () =>
    editor.chain().focus().setNodeSelection(pos).run(),
  );
}
