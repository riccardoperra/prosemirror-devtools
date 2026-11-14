import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

/** A node spotlight outlines one node. A text spotlight highlights an inline range. */
export interface SpotlightRange {
  readonly kind: "node" | "text";
  readonly from: number;
  readonly to: number;
}

export const spotlightKey = new PluginKey<SpotlightRange | null>("spotlight");

export function setSpotlight(tr: Transaction, spotlight: SpotlightRange): Transaction {
  return tr.setMeta(spotlightKey, spotlight);
}

export function getSpotlight(state: EditorState): SpotlightRange | null {
  return spotlightKey.getState(state) ?? null;
}

/**
 * Read-only editors cannot take focus, so the native selection of a jump stays invisible. The
 * spotlight is a decoration and shows regardless, until the selection moves somewhere else.
 */
export const spotlightPlugin = new Plugin<SpotlightRange | null>({
  key: spotlightKey,
  state: {
    init: () => null,
    apply(tr, value) {
      const next = tr.getMeta(spotlightKey) as SpotlightRange | undefined;
      if (next) return next;
      if (!value || tr.selectionSet) return null;
      if (!tr.docChanged) return value;
      const from = tr.mapping.map(value.from, 1);
      const to = tr.mapping.map(value.to, -1);
      return from < to ? { ...value, from, to } : null;
    },
  },
  props: {
    decorations(state) {
      const spotlight = getSpotlight(state);
      if (!spotlight) return null;
      const decoration =
        spotlight.kind === "node"
          ? Decoration.node(spotlight.from, spotlight.to, { class: "is-spotlit" })
          : Decoration.inline(spotlight.from, spotlight.to, { class: "spotlight-text" });
      return DecorationSet.create(state.doc, [decoration]);
    },
  },
});

export const Spotlight = Extension.create({
  name: "spotlight",
  addProseMirrorPlugins: () => [spotlightPlugin],
});
