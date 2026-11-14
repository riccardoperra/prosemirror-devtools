import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";

import { nodeNames } from "../document";
import { computeTotals, formatMoney } from "../model";
import { useInvoiceSelector } from "../view-context";

function TotalsView({ editor }: ReactNodeViewProps) {
  const { currency, totals } = useInvoiceSelector(editor, (invoice) => ({
    currency: invoice.meta.currency,
    totals: computeTotals(invoice.items),
  }));
  return (
    <NodeViewWrapper className="totals" contentEditable={false}>
      <dl>
        <div>
          <dt>Net amount</dt>
          <dd>{formatMoney(totals.net, currency)}</dd>
        </div>
        {totals.vatByRate.map((bucket) => (
          <div key={bucket.rate}>
            <dt>
              VAT {bucket.rate}% on {formatMoney(bucket.base, currency)}
            </dt>
            <dd>{formatMoney(bucket.tax, currency)}</dd>
          </div>
        ))}
        <div className="totals-gross">
          <dt>Amount due</dt>
          <dd aria-label="Amount due">{formatMoney(totals.gross, currency)}</dd>
        </div>
      </dl>
    </NodeViewWrapper>
  );
}

export const Totals = Node.create({
  name: nodeNames.totals,
  atom: true,
  selectable: false,
  parseHTML: () => [{ tag: "div[data-type=totals]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "totals" }),
  ],
  addNodeView: () => ReactNodeViewRenderer(TotalsView),
});
