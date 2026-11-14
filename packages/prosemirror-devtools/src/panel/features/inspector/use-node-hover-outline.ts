import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { onCleanup, type Accessor } from "solid-js";

import { useOptionalPanelInspection } from "../../panel-provider";
import { showNodeOverlay, type NodeTarget } from "./node-picker";

/** Outlines the hovered node in the editor while the panel shows the live editor state. */
export function useNodeHoverOutline(
  view: Accessor<EditorView>,
  state: Accessor<EditorState>,
): (target: NodeTarget | null) => void {
  const inspection = useOptionalPanelInspection();
  let hide: (() => void) | undefined;
  const clear = (): void => {
    hide?.();
    hide = undefined;
  };
  onCleanup(clear);

  return (target) => {
    clear();
    const editorView = view();
    if (
      !target ||
      !inspection ||
      inspection.moment().kind !== "live" ||
      editorView.isDestroyed ||
      editorView.state !== state()
    )
      return;
    hide = showNodeOverlay(editorView, target.pos, target.isRoot);
  };
}
