import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { memo } from "react";

import { TextField } from "../../ui/fields";
import { setStatus, updateMeta } from "../commands";
import { nodeNames } from "../document";
import {
  currencies,
  invoiceStatuses,
  isLocked,
  transitions,
  type Currency,
  type InvoiceMeta,
  type InvoiceStatus,
} from "../model";
import { textAttribute } from "./attributes";
import { sameNodeAndSelection } from "./memo";

function InvoiceMetaView({ node, editor }: ReactNodeViewProps) {
  const meta = node.attrs as InvoiceMeta;
  const locked = isLocked(meta.status);
  return (
    <NodeViewWrapper className="invoice-meta" contentEditable={false}>
      <div className="invoice-title">
        <h1>Invoice</h1>
        <span className="status-badge" data-status={meta.status}>
          {meta.status}
        </span>
      </div>
      <div className="meta-grid">
        <label>
          Number
          <TextField
            label="Invoice number"
            value={meta.number}
            disabled={locked}
            onCommit={(number) => updateMeta(editor, { number })}
          />
        </label>
        <label>
          Issued
          <TextField
            label="Issue date"
            type="date"
            value={meta.issueDate}
            disabled={locked}
            onCommit={(issueDate) => updateMeta(editor, { issueDate })}
          />
        </label>
        <label>
          Due
          <TextField
            label="Due date"
            type="date"
            value={meta.dueDate}
            disabled={locked}
            onCommit={(dueDate) => updateMeta(editor, { dueDate })}
          />
        </label>
        <label>
          Currency
          <select
            aria-label="Currency"
            value={meta.currency}
            disabled={locked}
            onChange={(event) => updateMeta(editor, { currency: event.target.value as Currency })}
          >
            {currencies.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            aria-label="Status"
            value={meta.status}
            disabled={locked}
            onChange={(event) => setStatus(editor, event.target.value as InvoiceStatus)}
          >
            {[meta.status, ...transitions[meta.status]].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>
    </NodeViewWrapper>
  );
}

export const InvoiceMetaNode = Node.create({
  name: nodeNames.meta,
  group: "section",
  atom: true,
  selectable: false,
  addAttributes: () => ({
    number: textAttribute("number", ""),
    issueDate: textAttribute("issueDate", ""),
    dueDate: textAttribute("dueDate", ""),
    currency: textAttribute("currency", "EUR"),
    status: textAttribute("status", invoiceStatuses[0]),
  }),
  parseHTML: () => [{ tag: "header[data-type=invoice-meta]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "header",
    mergeAttributes(HTMLAttributes, { "data-type": "invoice-meta" }),
  ],
  addNodeView: () => ReactNodeViewRenderer(memo(InvoiceMetaView, sameNodeAndSelection)),
});
