import type { Node as ProseMirrorNode } from "prosemirror-model";
import { AllSelection, NodeSelection, TextSelection, type Selection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { useCallback, useState } from "react";

export type SelectedDocumentNode = Readonly<{
  node: ProseMirrorNode;
  pos: number;
  isRoot: boolean;
}>;

type SelectedLocation = Readonly<{ pos: number; isRoot: boolean }>;

export function useDocumentSelection(view: EditorView): {
  selected: SelectedDocumentNode;
  select: (node: ProseMirrorNode, pos: number) => void;
  selectNode: (node: ProseMirrorNode, pos: number) => void;
  reveal: (pos: number) => void;
} {
  const doc = view.state.doc;
  const [location, setLocation] = useState<SelectedLocation>({ pos: 0, isRoot: true });
  const currentNode = location.isRoot ? doc : doc.nodeAt(location.pos);
  const selected: SelectedDocumentNode = currentNode
    ? { node: currentNode, pos: location.pos, isRoot: location.isRoot }
    : { node: doc, pos: 0, isRoot: true };

  const select = useCallback(
    (node: ProseMirrorNode, pos: number) => {
      setLocation({ pos, isRoot: node === view.state.doc });
    },
    [view],
  );

  const selectNode = useCallback(
    (node: ProseMirrorNode, pos: number) => {
      const currentDoc = view.state.doc;
      let editorSelection: Selection;

      if (node === currentDoc) {
        editorSelection = new AllSelection(currentDoc);
      } else if (node.isText) {
        editorSelection = TextSelection.create(currentDoc, pos, pos + node.nodeSize);
      } else if (NodeSelection.isSelectable(node)) {
        editorSelection = NodeSelection.create(currentDoc, pos);
      } else {
        const from = node.isLeaf ? pos : pos + 1;
        const to = node.isLeaf ? pos + node.nodeSize : pos + node.nodeSize - 1;
        editorSelection = TextSelection.between(currentDoc.resolve(from), currentDoc.resolve(to));
      }

      view.dispatch(view.state.tr.setSelection(editorSelection).scrollIntoView());
      view.focus();
    },
    [view],
  );

  const reveal = useCallback(
    (pos: number) => {
      const dom = view.nodeDOM(pos);
      const element = dom instanceof Element ? dom : dom?.parentElement;
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [view],
  );

  return { selected, select, selectNode, reveal };
}
