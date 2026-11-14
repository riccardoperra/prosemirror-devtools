import StarterKit from "@tiptap/starter-kit";

import { ActiveRow } from "../plugins/active-row";
import { DomainEvents } from "../plugins/domain-events";
import { Find } from "../plugins/find";
import { LineItemIds } from "../plugins/line-item-ids";
import { ReadOnlyByStatus } from "../plugins/read-only";
import { LineItemValidation } from "../plugins/validation";
import { Comment } from "./comment";
import { InvoiceDocument } from "./document";
import { Field } from "./field";
import { InvoiceMetaNode } from "./invoice-meta";
import { LineItemNode, LineItems } from "./line-items";
import { Parties, Party } from "./parties";
import { Totals } from "./totals";

export const invoiceExtensions = [
  StarterKit.configure({ document: false }),
  InvoiceDocument,
  InvoiceMetaNode,
  Parties,
  Party,
  LineItems,
  LineItemNode,
  Totals,
  Field,
  Comment,
  LineItemIds,
  LineItemValidation,
  Find,
  ActiveRow,
  DomainEvents,
  ReadOnlyByStatus,
];
