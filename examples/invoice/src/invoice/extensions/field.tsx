import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";

import { nodeNames } from "../document";
import { fieldRegistry, isFieldKey } from "../fields";
import { useInvoiceSelector } from "../view-context";

function FieldView({ node, editor, selected }: ReactNodeViewProps) {
  const key = node.attrs.key as string;
  const value = useInvoiceSelector(editor, (invoice) =>
    isFieldKey(key) ? fieldRegistry[key].resolve(invoice) : null,
  );
  return (
    <NodeViewWrapper
      as="span"
      className={selected ? "field-chip is-selected" : "field-chip"}
      data-field={key}
      title={isFieldKey(key) ? `${fieldRegistry[key].label} (${key})` : `Unknown field ${key}`}
    >
      {value || `{{${key}}}`}
    </NodeViewWrapper>
  );
}

export const Field = Node.create({
  name: nodeNames.field,
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => ({
    key: {
      default: "customer.name",
      parseHTML: (element) => element.getAttribute("data-field"),
      renderHTML: (attributes) => ({ "data-field": attributes.key }),
    },
  }),
  parseHTML: () => [{ tag: "span[data-field]" }],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes)],
  renderText: ({ node }) => `{{${node.attrs.key}}}`,
  addNodeView: () => ReactNodeViewRenderer(FieldView),
});
