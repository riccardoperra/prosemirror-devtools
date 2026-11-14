import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { nodeNames } from "../document";

function activeRow(state: EditorState): { from: number; to: number } | null {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name === nodeNames.lineItem) {
    return { from: selection.from, to: selection.to };
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === nodeNames.lineItem) {
      return { from: $from.before(depth), to: $from.after(depth) };
    }
  }
  return null;
}

export const activeRowKey = new PluginKey("activeRow");

export const activeRowPlugin = new Plugin({
  key: activeRowKey,
  props: {
    decorations(state) {
      const row = activeRow(state);
      return row
        ? DecorationSet.create(state.doc, [
            Decoration.node(row.from, row.to, { class: "is-active" }),
          ])
        : null;
    },
  },
});

export const ActiveRow = Extension.create({
  name: "activeRow",
  addProseMirrorPlugins: () => [activeRowPlugin],
});
