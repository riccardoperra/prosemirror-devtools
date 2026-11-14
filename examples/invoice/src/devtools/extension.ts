import { Extension } from "@tiptap/core";
import {
  createPluginStateInspector,
  createProseMirrorDevtoolsDiagnostics,
} from "prosemirror-inspector/core";
import { createTiptapInspector } from "prosemirror-inspector/inspectors/tiptap";
import {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
} from "prosemirror-inspector/tiptap";

import { activeRowKey } from "../invoice/plugins/active-row";
import { domainEventsKey } from "../invoice/plugins/domain-events";
import { findKey } from "../invoice/plugins/find";
import { lineItemIdsKey } from "../invoice/plugins/line-item-ids";
import { readOnlyKey } from "../invoice/plugins/read-only";
import { validationKey, validationPlugin } from "../invoice/plugins/validation";
import { registerDiagnostics, releaseDiagnostics, sessionId, store } from "./session";

const validationInspector = createPluginStateInspector({
  id: "invoice-validation",
  label: "Line item validation",
  plugin: validationPlugin,
  serialize: (value) => ({
    delayMs: value.delayMs,
    invalidRows: value.invalid.length,
    rows: value.invalid.slice(0, 20).map((row) => ({
      id: row.id,
      pos: row.pos,
      issues: row.issues.map((issue) => issue.code),
    })),
  }),
});

export const InvoiceDevtools = Extension.create({
  name: "prosemirrorInspector",
  priority: 10_000,
  onBeforeCreate() {
    const diagnostics = createProseMirrorDevtoolsDiagnostics({ limit: 500 });
    registerDiagnostics(this.editor, diagnostics);
    setupTiptapDevtools(this.editor, {
      id: sessionId,
      label: "Invoice",
      store,
      diagnostics,
      inspectors: [
        createTiptapInspector({
          editor: this.editor,
          pluginAssociations: [
            { extensionName: "lineItemIds", pluginKeys: [lineItemIdsKey] },
            { extensionName: "lineItemValidation", pluginKeys: [validationKey] },
            { extensionName: "find", pluginKeys: [findKey] },
            { extensionName: "activeRow", pluginKeys: [activeRowKey] },
            { extensionName: "invoiceDomainEvents", pluginKeys: [domainEventsKey] },
            { extensionName: "invoiceReadOnly", pluginKeys: [readOnlyKey] },
          ],
        }),
        validationInspector,
      ],
    });
  },
  onCreate() {
    attachTiptapDevtools(this.editor);
  },
  dispatchTransaction(props) {
    dispatchTiptapTransaction(this.editor, props);
  },
  onDestroy() {
    detachTiptapDevtools(this.editor);
    releaseDiagnostics(this.editor);
  },
});
