import { Node } from "@tiptap/core";

export const InvoiceDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "invoiceMeta parties lineItems totals block*",
});
