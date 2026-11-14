import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState, type Transaction } from "prosemirror-state";

import { measure } from "../../devtools/session";
import { lineItemRows } from "../document";

export const lineItemIdsKey = new PluginKey("lineItemIds");

/**
 * A duplicate takes the first free `<id>-<n>`. The result depends only on the document, so peers
 * that normalize the same document write the same ids and never fight over them.
 */
export function normalizeLineItemIds(state: EditorState): Transaction | null {
  const rows = lineItemRows(state.doc);
  const taken = new Set(rows.map(({ node }) => node.attrs.id as string));
  const seen = new Set<string>();
  let tr: Transaction | null = null;
  for (const { node, pos } of rows) {
    const id = node.attrs.id as string;
    if (id && !seen.has(id)) {
      seen.add(id);
      continue;
    }
    const base = id || "li";
    let suffix = 2;
    while (taken.has(`${base}-${suffix}`)) suffix += 1;
    const fresh = `${base}-${suffix}`;
    taken.add(fresh);
    seen.add(fresh);
    tr = (tr ?? state.tr).setNodeAttribute(pos, "id", fresh);
  }
  return tr;
}

export const lineItemIdsPlugin = new Plugin({
  key: lineItemIdsKey,
  appendTransaction(transactions, _oldState, state) {
    if (!transactions.some((tr) => tr.docChanged)) return null;
    return measure("Normalize line item ids", "normalizer", () => normalizeLineItemIds(state));
  },
});

export const LineItemIds = Extension.create({
  name: "lineItemIds",
  addProseMirrorPlugins: () => [lineItemIdsPlugin],
});
