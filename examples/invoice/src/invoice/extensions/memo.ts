import type { ReactNodeViewProps } from "@tiptap/react";

/**
 * Tiptap rerenders a node view whenever its decorations change, which happens to two rows on every
 * caret move because of the active-row decoration. Classes from decorations are applied to the
 * outer element by ProseMirror, so the React tree only depends on the node and its selection.
 */
export function sameNodeAndSelection(
  previous: Readonly<ReactNodeViewProps>,
  next: Readonly<ReactNodeViewProps>,
): boolean {
  return previous.node === next.node && previous.selected === next.selected;
}
