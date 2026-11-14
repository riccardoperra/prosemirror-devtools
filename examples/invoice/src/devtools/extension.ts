import { Extension } from "@tiptap/core";
import {
  createPluginStateInspector,
  createProseMirrorDevtoolsDiagnostics,
  type ProseMirrorInspector,
} from "prosemirror-inspector/core";
import type { EditorState, Plugin } from "prosemirror-state";
import { createHistoryInspector } from "prosemirror-inspector/inspectors/history";
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
import { spotlightKey } from "../invoice/plugins/spotlight";
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

/** prosemirror-history's key is private, so the installed plugin is found by its runtime key string. */
function installedHistory(state: EditorState): Plugin | undefined {
  return state.plugins.find((plugin) => (plugin as unknown as { key: string }).key === "history$");
}

export const InvoiceDevtools = Extension.create({
  name: "prosemirrorInspector",
  priority: 10_000,
  onBeforeCreate() {
    const diagnostics = createProseMirrorDevtoolsDiagnostics({ limit: 500 });
    registerDiagnostics(this.editor, diagnostics);
    const editor = this.editor;
    const inspectors: readonly ProseMirrorInspector[] = [
      createTiptapInspector({
        editor,
        pluginAssociations: [
          { extensionName: "lineItemIds", pluginKeys: [lineItemIdsKey] },
          { extensionName: "lineItemValidation", pluginKeys: [validationKey] },
          { extensionName: "find", pluginKeys: [findKey] },
          { extensionName: "activeRow", pluginKeys: [activeRowKey] },
          { extensionName: "invoiceDomainEvents", pluginKeys: [domainEventsKey] },
          { extensionName: "invoiceReadOnly", pluginKeys: [readOnlyKey] },
          { extensionName: "spotlight", pluginKeys: [spotlightKey] },
        ],
      }),
      validationInspector,
    ];
    setupTiptapDevtools(editor, {
      id: sessionId,
      label: "Invoice",
      store,
      diagnostics,
      performanceExtension: true,
      // Tiptap installs history() when it builds the state, after this hook. The session reads
      // its inspectors when it registers the mounted view, where the installed plugin exists.
      get inspectors() {
        const history = installedHistory(editor.state);
        return history ? [...inspectors, createHistoryInspector({ plugin: history })] : inspectors;
      },
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
