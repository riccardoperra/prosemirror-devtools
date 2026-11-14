import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";

import { markDomainEvents } from "../../devtools/session";

export const domainEventsKey = new PluginKey("invoiceDomainEvents");

export const DomainEvents = Extension.create({
  name: "invoiceDomainEvents",
  addProseMirrorPlugins: () => [
    new Plugin({
      key: domainEventsKey,
      appendTransaction(transactions) {
        markDomainEvents(transactions);
        return null;
      },
    }),
  ],
});
