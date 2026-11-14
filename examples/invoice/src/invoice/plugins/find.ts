import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { mark, measure } from "../../devtools/session";

export interface FindMatch {
  readonly from: number;
  readonly to: number;
}

export interface FindState {
  readonly query: string;
  readonly matches: readonly FindMatch[];
  readonly decorations: DecorationSet;
}

/** Inline atoms such as merge fields occupy one position, so a placeholder keeps string offsets equal to positions. */
const atomPlaceholder = "￼";

function search(doc: ProseMirrorNode, query: string): FindState {
  if (!query) return { query, matches: [], decorations: DecorationSet.empty };
  return measure("Find matches", "find", () => {
    const needle = query.toLocaleLowerCase();
    const matches: FindMatch[] = [];
    doc.descendants((node, pos) => {
      if (!node.isTextblock) return true;
      let text = "";
      node.forEach((child) => {
        text += child.isText ? child.text : atomPlaceholder.repeat(child.nodeSize);
      });
      const haystack = text.toLocaleLowerCase();
      for (let index = haystack.indexOf(needle); index >= 0;) {
        matches.push({ from: pos + 1 + index, to: pos + 1 + index + needle.length });
        index = haystack.indexOf(needle, index + needle.length);
      }
      return false;
    });
    const decorations = DecorationSet.create(
      doc,
      matches.map(({ from, to }) => Decoration.inline(from, to, { class: "find-match" })),
    );
    mark("Find decorations", "find", { query, decorations: matches.length });
    return { query, matches, decorations };
  });
}

export const findKey = new PluginKey<FindState>("find");

export function setFindQuery(tr: Transaction, query: string): Transaction {
  return tr.setMeta(findKey, { query });
}

export function getFindState(state: EditorState): FindState {
  return findKey.getState(state) ?? { query: "", matches: [], decorations: DecorationSet.empty };
}

export const findPlugin = new Plugin<FindState>({
  key: findKey,
  state: {
    init: () => ({ query: "", matches: [], decorations: DecorationSet.empty }),
    apply(tr, value, _oldState, newState) {
      const meta = tr.getMeta(findKey) as { query: string } | undefined;
      if (meta) return search(newState.doc, meta.query);
      return tr.docChanged && value.query ? search(newState.doc, value.query) : value;
    },
  },
  props: {
    decorations: (state) => findKey.getState(state)?.decorations,
  },
});

export const Find = Extension.create({
  name: "find",
  addProseMirrorPlugins: () => [findPlugin],
});
