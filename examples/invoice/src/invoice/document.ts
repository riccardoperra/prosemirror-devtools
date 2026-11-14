import type { Node as ProseMirrorNode } from "prosemirror-model";

import type { Invoice, InvoiceMeta, LineItem } from "./model";

export const nodeNames = {
  page: "page",
  meta: "invoiceMeta",
  parties: "parties",
  party: "party",
  lineItems: "lineItems",
  lineItem: "lineItem",
  totals: "totals",
  timesheet: "timesheet",
  paymentSchedule: "paymentSchedule",
  signatures: "signatures",
  signature: "signature",
  field: "field",
} as const;

export type PartyRole = "seller" | "buyer";

export interface PositionedNode {
  readonly node: ProseMirrorNode;
  readonly pos: number;
}

const fallbackMeta: InvoiceMeta = {
  number: "",
  issueDate: "",
  dueDate: "",
  currency: "EUR",
  status: "draft",
};

export function readLineItem(node: ProseMirrorNode): LineItem {
  const { id, quantity, unitPrice, vatRate, discountPercent } = node.attrs as Omit<
    LineItem,
    "description"
  >;
  return { id, quantity, unitPrice, vatRate, discountPercent, description: node.textContent };
}

/** Pages hold sections, so every invoice node lives at depth 2 and a scan never needs to go deeper. */
export function sections(doc: ProseMirrorNode): PositionedNode[] {
  const found: PositionedNode[] = [];
  doc.forEach((page, pagePos) => {
    page.forEach((node, offset) => found.push({ node, pos: pagePos + 1 + offset }));
  });
  return found;
}

export function pages(doc: ProseMirrorNode): PositionedNode[] {
  const found: PositionedNode[] = [];
  doc.forEach((node, pos) => found.push({ node, pos }));
  return found;
}

export function lineItemRows(doc: ProseMirrorNode): PositionedNode[] {
  const rows: PositionedNode[] = [];
  for (const { node, pos } of sections(doc)) {
    if (node.type.name !== nodeNames.lineItems) continue;
    node.forEach((row, offset) => rows.push({ node: row, pos: pos + 1 + offset }));
  }
  return rows;
}

/** Rows touched by the range, so a text selection across rows acts on every row it crosses. */
export function rowsInRange(doc: ProseMirrorNode, from: number, to: number): PositionedNode[] {
  return lineItemRows(doc).filter(
    ({ node, pos }) => pos + node.nodeSize > from && pos < Math.max(to, from + 1),
  );
}

export function findSection(doc: ProseMirrorNode, name: string): PositionedNode | null {
  return sections(doc).find(({ node }) => node.type.name === name) ?? null;
}

const invoices = new WeakMap<ProseMirrorNode, Invoice>();

/**
 * Every node view, the toolbar, and the read-only plugin read the invoice, so it is computed once
 * per document and selection-only transactions cost nothing.
 */
export function readInvoice(doc: ProseMirrorNode): Invoice {
  const cached = invoices.get(doc);
  if (cached) return cached;
  let meta = fallbackMeta;
  let seller = "";
  let buyer = "";
  const items: LineItem[] = [];
  for (const { node } of sections(doc)) {
    if (node.type.name === nodeNames.meta) meta = node.attrs as InvoiceMeta;
    if (node.type.name === nodeNames.lineItems)
      node.forEach((row) => items.push(readLineItem(row)));
    if (node.type.name === nodeNames.parties) {
      node.forEach((party) => {
        const name = party.firstChild?.textContent ?? "";
        if (party.attrs.role === "seller") seller = name;
        else buyer = name;
      });
    }
  }
  const invoice = { meta, seller, buyer, items };
  invoices.set(doc, invoice);
  return invoice;
}

export function readMeta(doc: ProseMirrorNode): InvoiceMeta {
  return readInvoice(doc).meta;
}

export function createLineItemId(): string {
  return `li-${crypto.randomUUID().slice(0, 8)}`;
}
