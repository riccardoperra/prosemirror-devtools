import { Node } from "@tiptap/core";

import { nodeNames } from "../document";

export const InvoiceDocument = Node.create({
  name: "doc",
  topNode: true,
  content: `${nodeNames.page}+`,
});
