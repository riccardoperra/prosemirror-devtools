import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { memo } from "react";

import { nodeNames } from "../document";
import {
  computeTotals,
  formatDate,
  formatMoney,
  scheduleInstallments,
  type InstallmentPlan,
} from "../model";
import { useInvoiceSelector } from "../view-context";
import { jsonAttribute } from "./attributes";
import { sameNodeAndSelection } from "./memo";

function PaymentScheduleView({ node, editor }: ReactNodeViewProps) {
  const plan = node.attrs.plan as readonly InstallmentPlan[];
  const { currency, installments } = useInvoiceSelector(editor, (invoice) => ({
    currency: invoice.meta.currency,
    installments: scheduleInstallments(
      computeTotals(invoice.items).gross,
      invoice.meta.issueDate,
      plan,
    ),
  }));
  return (
    <NodeViewWrapper className="schedule" contentEditable={false}>
      <table>
        <thead>
          <tr>
            <th>Installment</th>
            <th>Share</th>
            <th>Due</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((installment) => (
            <tr key={installment.label}>
              <td>{installment.label}</td>
              <td>{installment.percent}%</td>
              <td>{formatDate(installment.dueDate)}</td>
              <td>{formatMoney(installment.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </NodeViewWrapper>
  );
}

export const PaymentSchedule = Node.create({
  name: nodeNames.paymentSchedule,
  group: "section",
  atom: true,
  selectable: false,
  addAttributes: () => ({ plan: jsonAttribute<InstallmentPlan[]>("plan", []) }),
  parseHTML: () => [{ tag: "div[data-type=payment-schedule]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "payment-schedule" }),
  ],
  addNodeView: () => ReactNodeViewRenderer(memo(PaymentScheduleView, sameNodeAndSelection)),
});
