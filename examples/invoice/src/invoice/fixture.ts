import type { JSONContent } from "@tiptap/core";

import { cents, vatRates, type InvoiceMeta, type LineItem } from "./model";

const meta: InvoiceMeta = {
  number: "INV-2026-0142",
  issueDate: "2026-11-14",
  dueDate: "2026-12-14",
  currency: "EUR",
  status: "draft",
};

const lines: readonly LineItem[] = [
  {
    id: "li-design",
    description: "Editor architecture review",
    quantity: 2,
    unitPrice: cents(120_000),
    vatRate: 22,
    discountPercent: 0,
  },
  {
    id: "li-plugins",
    description: "Custom ProseMirror plugins, per plugin",
    quantity: 4,
    unitPrice: cents(45_000),
    vatRate: 22,
    discountPercent: 5,
  },
  {
    id: "li-training",
    description: "On-site team training (half day)",
    quantity: 1,
    unitPrice: cents(80_000),
    vatRate: 10,
    discountPercent: 0,
  },
  {
    id: "li-books",
    description: "Printed reference manuals",
    quantity: 6,
    unitPrice: cents(3_500),
    vatRate: 4,
    discountPercent: 0,
  },
  {
    id: "li-travel",
    description: "",
    quantity: 0,
    unitPrice: cents(18_000),
    vatRate: 0,
    discountPercent: 0,
  },
];

const text = (value: string, marks?: JSONContent["marks"]): JSONContent =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };

const paragraph = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });

function lineItem({ description, ...attrs }: LineItem): JSONContent {
  return description
    ? { type: "lineItem", attrs, content: [text(description)] }
    : { type: "lineItem", attrs };
}

export const initialInvoice: JSONContent = {
  type: "doc",
  content: [
    { type: "invoiceMeta", attrs: { ...meta } },
    {
      type: "parties",
      content: [
        {
          type: "party",
          attrs: { role: "seller" },
          content: [
            paragraph(text("Northwind Editorial Studio S.r.l.")),
            paragraph(text("Via Solferino 12, 20121 Milano, Italy")),
            paragraph(text("VAT IT 01234567890")),
          ],
        },
        {
          type: "party",
          attrs: { role: "buyer" },
          content: [
            paragraph(text("Acme Logistics GmbH")),
            paragraph(text("Speicherstadt 4, 20457 Hamburg, Germany")),
            paragraph(text("Attn. Accounts payable")),
          ],
        },
      ],
    },
    { type: "lineItems", content: lines.map(lineItem) },
    { type: "totals" },
    { type: "heading", attrs: { level: 3 }, content: [text("Notes")] },
    paragraph(
      text("Dear "),
      { type: "field", attrs: { key: "customer.name" } },
      text(", please pay "),
      { type: "field", attrs: { key: "invoice.total" } },
      text(" by "),
      { type: "field", attrs: { key: "invoice.dueDate" } },
      text(". "),
      text("Travel expenses are billed at cost.", [
        { type: "comment", attrs: { id: "c-travel", author: "Giulia", resolved: false } },
      ]),
    ),
    { type: "heading", attrs: { level: 3 }, content: [text("Payment terms")] },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [paragraph(text("Bank transfer to IBAN IT60 X054 2811 1010 0000 0123 456."))],
        },
        {
          type: "listItem",
          content: [paragraph(text("Late payments accrue statutory interest."))],
        },
      ],
    },
  ],
};

const stressDescriptions = [
  "Consulting hours",
  "Content migration batch",
  "Schema review",
  "Accessibility audit",
  "Performance profiling session",
];

/** Deterministic rows, with every 25th row invalid so validation decorations show up across the list. */
export function stressLineItems(count: number): LineItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `li-stress-${index + 1}`,
    description: `${stressDescriptions[index % stressDescriptions.length]} #${index + 1}`,
    quantity: index % 25 === 24 ? 0 : (index % 7) + 1,
    unitPrice: cents(2_500 + ((index * 1_337) % 40_000)),
    vatRate: vatRates[index % vatRates.length]!,
    discountPercent: index % 9 === 0 ? 10 : 0,
  }));
}
