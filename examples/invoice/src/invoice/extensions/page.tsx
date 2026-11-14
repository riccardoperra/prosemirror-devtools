import { mergeAttributes, Node } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { memo } from "react";

import { nodeNames, readMeta } from "../document";
import { isPageKind, pageKinds } from "../model";
import { textAttribute } from "./attributes";
import { sameNodeAndSelection } from "./memo";

function PageView({ node, editor, getPos, selected }: ReactNodeViewProps) {
  const kind = node.attrs.kind as string;
  const { number, index, count } = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const { doc } = current.state;
      const pos = getPos();
      let index = 0;
      doc.forEach((_page, offset, childIndex) => {
        if (offset === pos) index = childIndex;
      });
      return { number: readMeta(doc).number, index, count: doc.childCount };
    },
  });
  return (
    <NodeViewWrapper className={selected ? "page is-selected" : "page"} data-kind={kind}>
      <header className="page-header" contentEditable={false}>
        <span>{isPageKind(kind) ? pageKinds[kind].title : kind}</span>
        <span>{number}</span>
      </header>
      <NodeViewContent className="page-body" />
      <footer className="page-footer" contentEditable={false}>
        Page {index + 1} of {count}
      </footer>
    </NodeViewWrapper>
  );
}

export const Page = Node.create({
  name: nodeNames.page,
  content: "(section | block)+",
  isolating: true,
  addAttributes: () => ({ kind: textAttribute("kind", "continued") }),
  parseHTML: () => [{ tag: "section[data-type=page]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "section",
    mergeAttributes(HTMLAttributes, { "data-type": "page" }),
    0,
  ],
  addNodeView: () => ReactNodeViewRenderer(memo(PageView, sameNodeAndSelection)),
});
