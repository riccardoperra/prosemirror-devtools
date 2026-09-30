import type { Node as ProseMirrorNode } from "prosemirror-model";
import { AllSelection, NodeSelection, TextSelection, type Selection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { createMemo, createSignal, type Accessor } from "solid-js";

export type SelectedDocumentNode = Readonly<{
  node: ProseMirrorNode;
  pos: number;
  isRoot: boolean;
}>;

type SelectedLocation = Readonly<{ pos: number; isRoot: boolean }>;

export function useDocumentSelection(view: Accessor<EditorView>): {
  selected: Accessor<SelectedDocumentNode>;
  select: (node: ProseMirrorNode, pos: number) => void;
  selectNode: (node: ProseMirrorNode, pos: number) => void;
  reveal: (pos: number) => void;
} {
  const [location, setLocation] = createSignal<SelectedLocation>({ pos: 0, isRoot: true });
  const selected = createMemo<SelectedDocumentNode>(() => {
    const doc = view().state.doc;
    const current = location();
    const currentNode = current.isRoot
      ? doc
      : current.pos >= 0 && current.pos < doc.content.size
        ? doc.nodeAt(current.pos)
        : null;
    return currentNode
      ? { node: currentNode, pos: current.pos, isRoot: current.isRoot }
      : { node: doc, pos: 0, isRoot: true };
  });

  const select = (node: ProseMirrorNode, pos: number): void => {
    setLocation({ pos, isRoot: node === view().state.doc });
  };

  const selectNode = (node: ProseMirrorNode, pos: number): void => {
    const editorView = view();
    const currentDoc = editorView.state.doc;
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

    editorView.dispatch(editorView.state.tr.setSelection(editorSelection).scrollIntoView());
    editorView.focus();
  };

  const reveal = (pos: number): void => {
    const dom = view().nodeDOM(pos);
    const element = dom instanceof Element ? dom : dom?.parentElement;
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return { selected, select, selectNode, reveal };
}
