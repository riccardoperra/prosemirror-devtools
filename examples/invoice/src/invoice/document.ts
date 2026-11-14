import type { Node as ProseMirrorNode } from "prosemirror-model";

import type { Invoice, InvoiceMeta, LineItem } from "./model";

export const nodeNames = {
  meta: "invoiceMeta",
  parties: "parties",
  party: "party",
  lineItems: "lineItems",
  lineItem: "lineItem",
  totals: "totals",
  field: "field",
} as const;

export type PartyRole = "seller" | "buyer";

export interface PositionedNode {
  readonly node: ProseMirrorNode;
  readonly pos: number;
}

export function readMeta(doc: ProseMirrorNode): InvoiceMeta {
  return doc.child(0).attrs as InvoiceMeta;
}

export function readLineItem(node: ProseMirrorNode): LineItem {
  const { id, quantity, unitPrice, vatRate, discountPercent } = node.attrs as Omit<
    LineItem,
    "description"
  >;
  return { id, quantity, unitPrice, vatRate, discountPercent, description: node.textContent };
}

export function findLineItems(doc: ProseMirrorNode): PositionedNode {
  let found: PositionedNode | null = null;
  doc.forEach((node, pos) => {
    if (node.type.name === nodeNames.lineItems) found = { node, pos };
  });
  if (!found) throw new Error("The invoice schema requires a lineItems node.");
  return found;
}

export function lineItemRows(doc: ProseMirrorNode): PositionedNode[] {
  const container = findLineItems(doc);
  const rows: PositionedNode[] = [];
  container.node.forEach((node, offset) => rows.push({ node, pos: container.pos + 1 + offset }));
  return rows;
}

/** Rows touched by the range, so a text selection across rows acts on every row it crosses. */
export function rowsInRange(doc: ProseMirrorNode, from: number, to: number): PositionedNode[] {
  return lineItemRows(doc).filter(
    ({ node, pos }) => pos + node.nodeSize > from && pos < Math.max(to, from + 1),
  );
}

export function readPartyName(doc: ProseMirrorNode, role: PartyRole): string {
  let name = "";
  doc.child(1).forEach((party) => {
    if (party.attrs.role === role) name = party.firstChild?.textContent ?? "";
  });
  return name;
}

export function readInvoice(doc: ProseMirrorNode): Invoice {
  return {
    meta: readMeta(doc),
    seller: readPartyName(doc, "seller"),
    buyer: readPartyName(doc, "buyer"),
    items: lineItemRows(doc).map(({ node }) => readLineItem(node)),
  };
}

export function createLineItemId(): string {
  return `li-${crypto.randomUUID().slice(0, 8)}`;
}
