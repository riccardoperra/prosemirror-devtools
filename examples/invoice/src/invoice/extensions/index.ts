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
import { Page } from "./page";
import { PaymentSchedule } from "./payment-schedule";
import { Signature, Signatures } from "./signatures";
import { Timesheet } from "./timesheet";
import { Totals } from "./totals";

export const invoiceExtensions = [
  StarterKit.configure({ document: false, trailingNode: false }),
  Page,
  Timesheet,
  PaymentSchedule,
  Signatures,
  Signature,
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
