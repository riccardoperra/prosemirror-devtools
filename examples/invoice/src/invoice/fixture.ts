import type { JSONContent } from "@tiptap/core";

import {
  cents,
  vatRates,
  type InstallmentPlan,
  type InvoiceMeta,
  type LineItem,
  type PageKind,
  type TimesheetEntry,
} from "./model";

export const rowsPerPage = 22;

const meta: InvoiceMeta = {
  number: "INV-2026-0142",
  issueDate: "2026-11-14",
  dueDate: "2026-12-14",
  currency: "EUR",
  status: "draft",
};

const featuredRows: readonly LineItem[] = [
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

const generatedDescriptions = [
  "Consulting hours",
  "Content migration batch",
  "Schema review",
  "Accessibility audit",
  "Performance profiling session",
  "Collaboration backend support",
  "Release engineering",
];

/** Deterministic rows. `invalidEvery` plants rows that fail validation so decorations appear throughout. */
export function generateLineItems(count: number, invalidEvery = 0): LineItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `li-gen-${index + 1}`,
    description: `${generatedDescriptions[index % generatedDescriptions.length]} #${index + 1}`,
    quantity: invalidEvery && index % invalidEvery === invalidEvery - 1 ? 0 : (index % 7) + 1,
    unitPrice: cents(2_500 + ((index * 1_337) % 40_000)),
    vatRate: vatRates[index % vatRates.length]!,
    discountPercent: index % 9 === 0 ? 10 : 0,
  }));
}

const text = (value: string, marks?: JSONContent["marks"]): JSONContent =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };

const paragraph = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });

const heading = (level: number, value: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});

const list = (type: "bulletList" | "orderedList", items: string[]): JSONContent => ({
  type,
  content: items.map((item) => ({ type: "listItem", content: [paragraph(text(item))] })),
});

const page = (kind: PageKind, ...content: JSONContent[]): JSONContent => ({
  type: "page",
  attrs: { kind },
  content,
});

function lineItem({ description, ...attrs }: LineItem): JSONContent {
  return description
    ? { type: "lineItem", attrs, content: [text(description)] }
    : { type: "lineItem", attrs };
}

/** Explicit pagination: a fixed number of rows per page, with totals closing the last page. */
export function lineItemPages(items: readonly LineItem[], perPage = rowsPerPage): JSONContent[] {
  const result: JSONContent[] = [];
  for (let start = 0; start < Math.max(items.length, 1); start += perPage) {
    const rows = items.slice(start, start + perPage).map(lineItem);
    result.push(page("lineItems", { type: "lineItems", content: rows }));
  }
  result.at(-1)?.content?.push({ type: "totals" });
  return result;
}

const timesheet: readonly TimesheetEntry[] = [
  { project: "Editor architecture", date: "2026-10-05", person: "Giulia R.", hours: 6 },
  { project: "Editor architecture", date: "2026-10-06", person: "Marco T.", hours: 7.5 },
  { project: "Editor architecture", date: "2026-10-09", person: "Giulia R.", hours: 4 },
  { project: "Plugin development", date: "2026-10-12", person: "Sara L.", hours: 8 },
  { project: "Plugin development", date: "2026-10-13", person: "Sara L.", hours: 8 },
  { project: "Plugin development", date: "2026-10-14", person: "Marco T.", hours: 5.5 },
  { project: "Plugin development", date: "2026-10-20", person: "Sara L.", hours: 3 },
  { project: "Training", date: "2026-10-27", person: "Giulia R.", hours: 4 },
  { project: "Training", date: "2026-10-27", person: "Marco T.", hours: 4 },
];

const installments: readonly InstallmentPlan[] = [
  { label: "On signature", percent: 30, dueAfterDays: 0 },
  { label: "Milestone delivery", percent: 40, dueAfterDays: 30 },
  { label: "Final acceptance", percent: 30, dueAfterDays: 60 },
];

export const defaultLineItems: readonly LineItem[] = [...featuredRows, ...generateLineItems(60)];

export const initialInvoice: JSONContent = {
  type: "doc",
  content: [
    page(
      "cover",
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
      paragraph(
        text("Dear "),
        { type: "field", attrs: { key: "customer.name" } },
        text(", this dossier covers the editor platform engagement for October 2026."),
      ),
    ),
    ...lineItemPages(defaultLineItems),
    page(
      "timesheet",
      heading(2, "Hours by project"),
      paragraph(text("Hours logged against the time-and-materials rows of this invoice.")),
      { type: "timesheet", attrs: { entries: timesheet } },
    ),
    page(
      "schedule",
      heading(2, "Payment schedule"),
      paragraph(
        text("Installments are derived from the amount due of "),
        { type: "field", attrs: { key: "invoice.total" } },
        text("."),
      ),
      { type: "paymentSchedule", attrs: { plan: installments } },
    ),
    page(
      "terms",
      heading(2, "Terms"),
      list("orderedList", [
        "Payment by bank transfer to IBAN IT60 X054 2811 1010 0000 0123 456.",
        "Late payments accrue statutory interest under Legislative Decree 231/2002.",
        "Disputes must be raised in writing within 15 days of the issue date.",
      ]),
      heading(3, "Notes"),
      paragraph(
        text("Please pay "),
        { type: "field", attrs: { key: "invoice.total" } },
        text(" by "),
        { type: "field", attrs: { key: "invoice.dueDate" } },
        text(". "),
        text("Travel expenses are billed at cost.", [
          { type: "comment", attrs: { id: "c-travel", author: "Giulia", resolved: false } },
        ]),
      ),
      list("bulletList", [
        "Rates include project management and code review.",
        "Hardware and third-party licences are not included.",
      ]),
      {
        type: "blockquote",
        content: [
          paragraph(
            text("Thank you for trusting us with your editor. ", [{ type: "italic" }]),
            text("Northwind Editorial Studio"),
          ),
        ],
      },
    ),
    page(
      "signatures",
      heading(2, "Acceptance"),
      paragraph(text("Signing confirms acceptance of the amounts and terms above.")),
      {
        type: "signatures",
        content: [
          { type: "signature", attrs: { role: "Supplier", name: "Giulia Rossi" } },
          { type: "signature", attrs: { role: "Customer", name: "Jonas Becker" } },
        ],
      },
    ),
  ],
};
