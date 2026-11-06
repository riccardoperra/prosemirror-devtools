import type { Node as ProseMirrorNode } from "prosemirror-model";
import {
  AllSelection,
  NodeSelection,
  TextSelection,
  type Selection,
  type EditorState,
} from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { createMemo, createSignal, type Accessor } from "solid-js";
import { useOptionalPanelInspection } from "../../panel-provider";

export type SelectedDocumentNode = Readonly<{
  node: ProseMirrorNode;
  pos: number;
  isRoot: boolean;
}>;

type SelectedLocation = Readonly<{ pos: number; isRoot: boolean }>;

export function useDocumentSelection(
  view: Accessor<EditorView>,
  state: Accessor<EditorState> = () => view().state,
): {
  selected: Accessor<SelectedDocumentNode>;
  select: (node: ProseMirrorNode, pos: number) => void;
  selectNode: (node: ProseMirrorNode, pos: number) => void;
  reveal: (pos: number) => void;
} {
  const [location, setLocation] = createSignal<SelectedLocation>({ pos: 0, isRoot: true });
  const inspection = useOptionalPanelInspection();
  const selected = createMemo<SelectedDocumentNode>(() => {
    const doc = state().doc;
    const shared = inspection?.position();
    const current = inspection
      ? shared?.doc === doc
        ? shared
        : { pos: 0, isRoot: true }
      : location();
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
    const doc = state().doc;
    const next = { pos, isRoot: node === doc };
    if (inspection) inspection.selectPosition({ ...next, doc });
    else setLocation(next);
  };

  const selectNode = (node: ProseMirrorNode, pos: number): void => {
    const editorView = view();
    if (
      inspection &&
      (inspection.moment().kind !== "live" || inspection.instance()?.view !== editorView)
    )
      return;
    if (editorView.state !== state()) return;
    const currentDoc = state().doc;
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
    if (
      inspection &&
      (inspection.moment().kind !== "live" || inspection.instance()?.view !== view())
    )
      return;
    if (view().state !== state()) return;
    const dom = view().nodeDOM(pos);
    const element = dom instanceof Element ? dom : dom?.parentElement;
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return { selected, select, selectNode, reveal };
}
