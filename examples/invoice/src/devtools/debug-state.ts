import type { EditorState } from "prosemirror-state";

import { collectComments, type CommentThread } from "../invoice/comments";
import { pages, readInvoice } from "../invoice/document";
import {
  computeTotals,
  isLocked,
  lineItemRules,
  transitions,
  type Currency,
  type InvoiceStatus,
  type InvoiceTotals,
} from "../invoice/model";
import { getFindState } from "../invoice/plugins/find";
import { validationKey } from "../invoice/plugins/validation";
import type { DomainEventEntry } from "./session";

export interface IssueGroup {
  readonly code: string;
  readonly message: string;
  readonly rows: readonly { readonly id: string; readonly pos: number }[];
}

export interface InvoiceDebugState {
  readonly document: {
    readonly status: InvoiceStatus;
    readonly next: readonly InvoiceStatus[];
    readonly editable: boolean;
    readonly pages: number;
    readonly rows: number;
    readonly currency: Currency;
    readonly totals: InvoiceTotals;
  };
  readonly comments: readonly CommentThread[];
  readonly validation: {
    readonly delayMs: number;
    readonly invalidRows: number;
    readonly groups: readonly IssueGroup[];
  };
  readonly find: { readonly query: string; readonly matches: number };
  readonly events: readonly DomainEventEntry[];
}

function groupIssues(state: EditorState): InvoiceDebugState["validation"] {
  const validation = validationKey.getState(state);
  if (!validation) return { delayMs: 0, invalidRows: 0, groups: [] };
  const groups = lineItemRules
    .map(({ code, message }) => ({
      code,
      message,
      rows: validation.invalid
        .filter((row) => row.issues.some((issue) => issue.code === code))
        .map(({ id, pos }) => ({ id, pos })),
    }))
    .filter((group) => group.rows.length > 0);
  return { delayMs: validation.delayMs, invalidRows: validation.invalid.length, groups };
}

/** Domain events live outside the editor state, so the caller passes the app's event log in. */
export function readInvoiceDebugState(
  state: EditorState,
  events: readonly DomainEventEntry[],
): InvoiceDebugState {
  const invoice = readInvoice(state.doc);
  const { status, currency } = invoice.meta;
  const find = getFindState(state);
  return {
    document: {
      status,
      next: transitions[status],
      editable: !isLocked(status),
      pages: pages(state.doc).length,
      rows: invoice.items.length,
      currency,
      totals: computeTotals(invoice.items),
    },
    comments: collectComments(state.doc),
    validation: groupIssues(state),
    find: { query: find.query, matches: find.matches.length },
    events,
  };
}
