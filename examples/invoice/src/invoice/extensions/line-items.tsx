import { mergeAttributes, Node } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from "@tiptap/react";

import { traceCommand } from "../../devtools/session";
import { NumberField } from "../../ui/fields";
import { deleteRows, selectRow } from "../commands";
import { nodeNames, readLineItem } from "../document";
import { formatMoney, isVatRate, lineNet, vatRates, type LineItem } from "../model";
import { useInvoiceView } from "../view-context";
import { numberAttribute, textAttribute } from "./attributes";

const columns = ["Description", "Qty", "Unit price", "VAT", "Discount", "Amount"];

export const LineItems = Node.create({
  name: nodeNames.lineItems,
  content: `${nodeNames.lineItem}+`,
  isolating: true,
  parseHTML: () => [{ tag: "div[data-type=line-items]", contentElement: ".line-items-body" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "line-items", class: "line-items" }),
    [
      "div",
      { class: "line-items-header", contenteditable: "false", "aria-hidden": "true" },
      ...columns.map((label) => ["span", label]),
      ["span"],
    ],
    ["div", { class: "line-items-body" }, 0],
  ],
});

function LineItemView({ node, editor, getPos, updateAttributes }: ReactNodeViewProps) {
  const { editable, currency } = useInvoiceView();
  const item = readLineItem(node);
  const update = (attrs: Partial<LineItem>) =>
    traceCommand(editor, "Edit line item", () => updateAttributes(attrs));
  const position = () => {
    const pos = getPos();
    return typeof pos === "number" ? pos : null;
  };
  return (
    <NodeViewWrapper className="line-item" data-row-id={item.id}>
      <button
        type="button"
        className="row-handle"
        contentEditable={false}
        data-drag-handle=""
        draggable
        aria-label="Select line item"
        title="Click to select the row, drag to move it"
        onClick={() => {
          const pos = position();
          if (pos !== null) selectRow(editor, pos);
        }}
      >
        ⋮⋮
      </button>
      <NodeViewContent className="row-description" />
      <div className="row-fields" contentEditable={false}>
        <NumberField
          label="Quantity"
          className="row-quantity"
          value={item.quantity}
          step={1}
          min={0}
          disabled={!editable}
          onCommit={(quantity) => update({ quantity })}
        />
        <NumberField
          label="Unit price"
          className="row-price"
          value={item.unitPrice}
          scale={100}
          step={0.01}
          min={0}
          disabled={!editable}
          onCommit={(unitPrice) => update({ unitPrice: unitPrice as LineItem["unitPrice"] })}
        />
        <select
          aria-label="VAT rate"
          className="row-vat"
          value={item.vatRate}
          disabled={!editable}
          onChange={(event) => {
            const rate = Number(event.target.value);
            if (isVatRate(rate)) update({ vatRate: rate });
          }}
        >
          {vatRates.map((rate) => (
            <option key={rate} value={rate}>
              {rate}%
            </option>
          ))}
        </select>
        <NumberField
          label="Discount percent"
          className="row-discount"
          value={item.discountPercent}
          step={1}
          min={0}
          max={100}
          disabled={!editable}
          onCommit={(discountPercent) => update({ discountPercent })}
        />
        <output className="row-total" aria-label="Line amount">
          {formatMoney(lineNet(item), currency)}
        </output>
        <button
          type="button"
          className="row-delete"
          aria-label="Delete line item"
          disabled={!editable}
          onClick={() => {
            const pos = position();
            if (pos !== null) deleteRows(editor, pos);
          }}
        >
          ×
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export const LineItemNode = Node.create({
  name: nodeNames.lineItem,
  content: "inline*",
  draggable: true,
  defining: true,
  addAttributes: () => ({
    id: textAttribute("id", "", false),
    quantity: numberAttribute("quantity", 1),
    unitPrice: numberAttribute("unitPrice", 0),
    vatRate: numberAttribute("vatRate", 22),
    discountPercent: numberAttribute("discountPercent", 0),
  }),
  parseHTML: () => [{ tag: "div[data-type=line-item]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "line-item" }),
    0,
  ],
  addNodeView: () => ReactNodeViewRenderer(LineItemView),
});
