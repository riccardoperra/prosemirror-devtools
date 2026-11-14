import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";

import { readMeta } from "../document";
import { isLocked } from "../model";

export const readOnlyKey = new PluginKey("invoiceReadOnly");

/** The status attribute is the single source of truth, so editability is derived from the state on every read. */
export const ReadOnlyByStatus = Extension.create({
  name: "invoiceReadOnly",
  addProseMirrorPlugins: () => [
    new Plugin({
      key: readOnlyKey,
      props: { editable: (state) => !isLocked(readMeta(state.doc).status) },
    }),
  ],
});
