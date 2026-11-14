import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type Transaction } from "prosemirror-state";

import { measure } from "../../devtools/session";
import { createLineItemId, lineItemRows } from "../document";

export const lineItemIdsKey = new PluginKey("lineItemIds");

export const lineItemIdsPlugin = new Plugin({
  key: lineItemIdsKey,
  appendTransaction(transactions, _oldState, state) {
    if (!transactions.some((tr) => tr.docChanged)) return null;
    return measure("Normalize line item ids", "normalizer", () => {
      const seen = new Set<string>();
      let tr: Transaction | null = null;
      for (const { node, pos } of lineItemRows(state.doc)) {
        const id = node.attrs.id as string;
        if (id && !seen.has(id)) {
          seen.add(id);
          continue;
        }
        const fresh = createLineItemId();
        seen.add(fresh);
        tr = (tr ?? state.tr).setNodeAttribute(pos, "id", fresh);
      }
      return tr;
    });
  },
});

export const LineItemIds = Extension.create({
  name: "lineItemIds",
  addProseMirrorPlugins: () => [lineItemIdsPlugin],
});
