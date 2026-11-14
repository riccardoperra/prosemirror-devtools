import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { memo } from "react";

import { traceCommand } from "../../devtools/session";
import { nodeNames } from "../document";
import { formatDate } from "../model";
import { useInvoiceView } from "../view-context";
import { textAttribute } from "./attributes";
import { sameNodeAndSelection } from "./memo";

export const Signatures = Node.create({
  name: nodeNames.signatures,
  group: "section",
  content: `${nodeNames.signature}+`,
  isolating: true,
  parseHTML: () => [{ tag: "div[data-type=signatures]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "signatures", class: "signatures" }),
    0,
  ],
});

function SignatureView({ node, editor, updateAttributes, selected }: ReactNodeViewProps) {
  const { editable } = useInvoiceView();
  const { role, name, signedAt } = node.attrs as { role: string; name: string; signedAt: string };
  return (
    <NodeViewWrapper className={selected ? "signature is-selected" : "signature"}>
      <div className="signature-line">
        {signedAt ? <span className="signature-ink">{name}</span> : null}
      </div>
      <div className="signature-caption">
        <span>
          {role} · {name}
        </span>
        {signedAt ? (
          <span>Signed {formatDate(signedAt)}</span>
        ) : (
          <button
            type="button"
            disabled={!editable}
            onClick={() =>
              traceCommand(editor, "Sign", () =>
                updateAttributes({ signedAt: new Date().toISOString().slice(0, 10) }),
              )
            }
          >
            Sign as {name}
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const Signature = Node.create({
  name: nodeNames.signature,
  atom: true,
  addAttributes: () => ({
    role: textAttribute("role", ""),
    name: textAttribute("name", ""),
    signedAt: textAttribute("signedAt", ""),
  }),
  parseHTML: () => [{ tag: "div[data-type=signature]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "signature" }),
  ],
  addNodeView: () => ReactNodeViewRenderer(memo(SignatureView, sameNodeAndSelection)),
});
