import { Extension, type AnyExtension, type Editor } from "@tiptap/core";
import { ySyncPluginKey, yUndoPluginKey } from "@tiptap/y-tiptap";
import {
  createPluginStateInspector,
  createProseMirrorDevtoolsDiagnostics,
  type ProseMirrorInspector,
} from "prosemirror-inspector/core";
import { createHistoryInspector } from "prosemirror-inspector/inspectors/history";
import { createTiptapInspector } from "prosemirror-inspector/inspectors/tiptap";
import {
  createTransportObserver,
  type TransportSignal,
} from "prosemirror-inspector/inspectors/transport";
import { createYjsInspector } from "prosemirror-inspector/inspectors/yjs";
import {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
} from "prosemirror-inspector/tiptap";

import type { ProviderEvent } from "../collab/broadcast-provider";
import type { CollabSession } from "../collab/session";
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

/** Awareness traffic is presence, not document transport, so only document messages are reported. */
function transportSignal(event: ProviderEvent): TransportSignal | null {
  if (event.kind === "connection") return event;
  if (event.type !== "update" && event.type !== "sync-step-2") return null;
  return {
    kind: event.kind,
    messageId: event.messageId,
    payload: { kind: "yjs-update", bytes: event.bytes },
    dispatch: { kind: "unknown" },
  };
}

function collabInspectors(editor: Editor, collab: CollabSession) {
  const transport = createTransportObserver();
  transport.observe({ kind: "connection", state: "connected" });
  const stop = collab.provider.subscribe((event) => {
    const signal = transportSignal(event);
    if (signal) transport.observe(signal);
  });
  const undoManager = () => yUndoPluginKey.getState(editor.state)?.undoManager;
  const yjs = createYjsInspector({
    document: collab.doc,
    transport,
    getUndoManager: undoManager,
    describeOrigin: (origin) =>
      origin === collab.provider
        ? "BroadcastChannel receive"
        : origin === ySyncPluginKey
          ? "Local ProseMirror edit"
          : origin === undoManager()
            ? "Yjs undo manager"
            : "Unknown Yjs origin",
  });
  return {
    inspectors: [yjs],
    dispose() {
      stop();
      yjs.dispose();
    },
  };
}

/** One extension per editor lifecycle. A collaborative editor adds the Yjs and transport inspectors. */
export const createInvoiceDevtools = (collab: CollabSession | null): AnyExtension =>
  Extension.create<object, { disposeCollab: () => void }>({
    name: "prosemirrorInspector",
    priority: 10_000,
    addStorage: () => ({ disposeCollab: () => {} }),
    onBeforeCreate() {
      const diagnostics = createProseMirrorDevtoolsDiagnostics({ limit: 500 });
      registerDiagnostics(this.editor, diagnostics);
      const editor = this.editor;
      const shared = collab ? collabInspectors(editor, collab) : null;
      this.storage.disposeCollab = () => shared?.dispose();
      const inspectors: readonly ProseMirrorInspector[] = [
        ...(shared?.inspectors ?? [createHistoryInspector()]),
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
        inspectors,
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
      this.storage.disposeCollab();
    },
  });
