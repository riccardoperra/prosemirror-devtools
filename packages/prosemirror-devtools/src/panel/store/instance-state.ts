import type { EditorState } from "prosemirror-state";
import type { RegisteredProseMirrorInstance } from "../../core/types";

export function readInstanceState(instance: RegisteredProseMirrorInstance): EditorState {
  return instance.inspection?.getState() ?? instance.view.state;
}
