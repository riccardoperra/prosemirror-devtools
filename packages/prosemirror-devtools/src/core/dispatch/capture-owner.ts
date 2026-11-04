import type { EditorView } from "prosemirror-view";

const captureOwners = new WeakMap<EditorView, "patched" | "middleware">();

export function claimDispatchCapture(view: EditorView, kind: "patched" | "middleware"): () => void {
  if (captureOwners.has(view)) {
    throw new Error("This EditorView already has a devtools dispatch capture path.");
  }
  captureOwners.set(view, kind);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    captureOwners.delete(view);
  };
}
