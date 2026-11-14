import { computeTotals, formatDate, formatMoney, type Invoice } from "./model";

interface FieldDefinition {
  readonly label: string;
  resolve(invoice: Invoice): string;
}

export const fieldRegistry = {
  "customer.name": { label: "Customer name", resolve: (invoice) => invoice.buyer },
  "seller.name": { label: "Seller name", resolve: (invoice) => invoice.seller },
  "invoice.number": { label: "Invoice number", resolve: (invoice) => invoice.meta.number },
  "invoice.dueDate": {
    label: "Due date",
    resolve: (invoice) => formatDate(invoice.meta.dueDate),
  },
  "invoice.total": {
    label: "Amount due",
    resolve: (invoice) => formatMoney(computeTotals(invoice.items).gross, invoice.meta.currency),
  },
} as const satisfies Record<string, FieldDefinition>;

export type FieldKey = keyof typeof fieldRegistry;

export const fieldKeys = Object.keys(fieldRegistry) as FieldKey[];

export function isFieldKey(value: string): value is FieldKey {
  return Object.hasOwn(fieldRegistry, value);
}
