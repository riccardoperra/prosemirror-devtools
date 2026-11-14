import { Editor, Extension } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import StarterKit from "@tiptap/starter-kit";
import { ySyncPluginKey, yUndoPluginKey } from "@tiptap/y-tiptap";
import * as Y from "yjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createProseMirrorDevtoolsStore,
  createProseMirrorInspectionClient,
  type DevtoolsStore,
} from "../src/core";
import {
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
} from "../src/adapters/tiptap";
import { readDispatchEffects } from "../src/panel/features/dispatch/read-dispatch-effects";
import { createYjsInspector, type YjsInspector } from "../src/inspectors/yjs";
import { createTransportObserver, type TransportObserver } from "../src/inspectors/transport";

const editors = new Set<Editor>();
const documents = new Set<Y.Doc>();

function createEditor(
  document: Y.Doc,
  id: string,
  store: DevtoolsStore,
  transport: TransportObserver,
  describeOrigin?: (origin: unknown) => string,
  syncPluginKey?: typeof ySyncPluginKey,
): { editor: Editor; inspector: YjsInspector } {
  const holder: { inspector: YjsInspector | null } = { inspector: null };
  const native = Extension.create({
    name: "inspector",
    priority: 10000,
    onBeforeCreate() {
      const editor = this.editor;
      const inspector = createYjsInspector({
        document,
        transport,
        ...(describeOrigin ? { describeOrigin } : {}),
        ...(syncPluginKey ? { syncPluginKey } : {}),
        getUndoManager: () => yUndoPluginKey.getState(editor.state)?.undoManager,
      });
      holder.inspector = inspector;
      setupTiptapDevtools(editor, { id, store, performanceMarks: false, inspectors: [inspector] });
    },
    dispatchTransaction(props) {
      dispatchTiptapTransaction(this.editor, props);
    },
    onDestroy() {
      detachTiptapDevtools(this.editor);
      holder.inspector?.dispose();
    },
  });
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ undoRedo: false, trailingNode: false }),
      Collaboration.configure({ document }),
      native,
    ],
    enableExtensionDispatchTransaction: true,
  });
  editors.add(editor);
  if (!holder.inspector) throw new Error("The native Yjs observer did not initialize");
  return { editor, inspector: holder.inspector };
}

afterEach(() => {
  for (const editor of editors) editor.destroy();
  for (const document of documents) document.destroy();
  editors.clear();
  documents.clear();
  document.body.replaceChildren();
});

describe("independent Yjs inspector", () => {
  it("observes actual two-editor Yjs updates and uses the binding's collaborative undo", () => {
    const store = createProseMirrorDevtoolsStore();
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    documents.add(docA);
    documents.add(docB);
    const transportA = createTransportObserver();
    const transportB = createTransportObserver();
    const describeOrigin = vi.fn(() => "application-known origin");
    const a = createEditor(docA, "y-A", store, transportA, describeOrigin);
    const b = createEditor(docB, "y-B", store, transportB);
    let message = 0;
    const forward = (
      sender: Y.Doc,
      receiver: Y.Doc,
      senderTransport: TransportObserver,
      receiverTransport: TransportObserver,
    ) => {
      const receiveOrigin = `received-${receiver.clientID}`;
      const skipOrigin = `received-${sender.clientID}`;
      const listener = (update: Uint8Array, origin: unknown) => {
        if (origin === skipOrigin) return;
        const messageId = `message-${++message}`;
        senderTransport.observe({
          kind: "send",
          messageId,
          payload: { kind: "yjs-update", bytes: update.byteLength },
          dispatch: { kind: "unknown" },
        });
        receiverTransport.observe({
          kind: "receive",
          messageId,
          payload: { kind: "yjs-update", bytes: update.byteLength },
          dispatch: { kind: "unknown" },
        });
        Y.applyUpdate(receiver, update, receiveOrigin);
        senderTransport.observe({
          kind: "acknowledge",
          messageId,
          confirmedVersion: null,
          dispatch: { kind: "unknown" },
        });
      };
      sender.on("update", listener);
      return () => sender.off("update", listener);
    };
    const disconnectA = forward(docA, docB, transportA, transportB);
    const disconnectB = forward(docB, docA, transportB, transportA);
    transportA.observe({ kind: "connection", state: "connected" });
    transportB.observe({ kind: "connection", state: "connected" });
    try {
      a.editor.commands.insertContent("Alpha");
      expect(a.editor.state.doc.textContent).toBe("Alpha");
      expect(b.editor.state.doc.textContent).toBe("Alpha");
      expect(yUndoPluginKey.getState(a.editor.state)?.undoManager.undoStack).toHaveLength(1);
      expect(yUndoPluginKey.getState(b.editor.state)?.undoManager.undoStack).toHaveLength(0);
      const captured = store.getInstance("y-A")?.transactions.at(-1)?.inspection
        ?.projections[0]?.evidence;
      expect(captured).toMatchObject({
        kind: "available",
        value: {
          binding: "yjs",
          undo: { kind: "available", value: { undoDepth: 1, redoDepth: 0 } },
          latestUpdate: { bytes: expect.any(Number), local: true },
          scope: "independent-document-and-provider-signals",
        },
      });
      b.editor.commands.insertContent("Beta");
      expect(a.editor.state.doc.textContent).toContain("Beta");
      expect(a.editor.commands.undo()).toBe(true);
      expect(a.editor.state.doc.textContent).toBe("Beta");
      expect(b.editor.state.doc.textContent).toBe("Beta");
      expect(
        a.editor.extensionManager.extensions.some((extension) => extension.name === "undoRedo"),
      ).toBe(false);
      expect(yUndoPluginKey.getState(a.editor.state)?.undoManager.redoStack).toHaveLength(1);
      expect(
        store.getInstance("y-A")?.transactions.at(-1)?.inspection?.projections[0]?.evidence,
      ).toMatchObject({
        kind: "available",
        value: {
          sample: "prosemirror-dispatch",
          undo: { kind: "available", value: { undoDepth: 0, redoDepth: 0 } },
        },
      });
      const client = createProseMirrorInspectionClient({ store });
      const target = client
        .listEditors()
        .find((editor) => editor.target.editorId === "y-A")?.target;
      if (!target) throw new Error("The Yjs editor target was not registered");
      expect(client.query({ target, query: { kind: "contribution", id: "yjs" } })).toMatchObject({
        kind: "available",
        value: {
          sample: "query",
          undo: { kind: "available", value: { undoDepth: 0, redoDepth: 1 } },
        },
      });
      expect(captured).toMatchObject({
        kind: "available",
        value: { undo: { kind: "available", value: { undoDepth: 1, redoDepth: 0 } } },
      });
      expect(transportA.getSnapshot().counts.receives).toBeGreaterThan(0);
      const callsBeforeDispose = describeOrigin.mock.calls.length;
      a.inspector.dispose();
      a.editor.commands.insertContent("Z");
      expect(a.editor.state.doc.textContent).toContain("Z");
      expect(describeOrigin.mock.calls).toHaveLength(callsBeforeDispose);
      expect(client.query({ target, query: { kind: "contribution", id: "yjs" } }).kind).toBe(
        "disabled",
      );
      expect(
        store.getInstance("y-A")?.transactions.at(-1)?.inspection?.projections[0]?.evidence.kind,
      ).toBe("disabled");
    } finally {
      disconnectA();
      disconnectB();
    }
  });
});

describe("Yjs dispatch origin", () => {
  const relay = (from: Y.Doc, to: Y.Doc) => {
    const origin = { relay: `${from.clientID}->${to.clientID}` };
    const listener = (update: Uint8Array, updateOrigin: unknown) => {
      if (typeof updateOrigin === "object" && updateOrigin && "relay" in updateOrigin) return;
      Y.applyUpdate(to, update, origin);
    };
    from.on("update", listener);
    return () => from.off("update", listener);
  };
  const pair = (syncPluginKey?: typeof ySyncPluginKey) => {
    const store = createProseMirrorDevtoolsStore();
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    documents.add(docA);
    documents.add(docB);
    const a = createEditor(docA, "A", store, createTransportObserver(), undefined, syncPluginKey);
    const b = createEditor(docB, "B", store, createTransportObserver(), undefined, syncPluginKey);
    const disconnect = [relay(docA, docB), relay(docB, docA)];
    const last = (id: string) => {
      const record = store.getInstance(id)?.transactions.at(-1);
      if (!record) throw new Error(`No dispatch was captured for ${id}`);
      const projection = record.inspection?.projections.find((entry) => entry.id === "yjs");
      return { record, evidence: projection?.evidence };
    };
    return { a, b, last, disconnect: () => disconnect.forEach((stop) => stop()) };
  };

  it("captures the receiving editor's dispatch as remote and the typing editor's as local", () => {
    const { a, b, last, disconnect } = pair(ySyncPluginKey);
    try {
      a.editor.commands.insertContent("Alpha");
      expect(b.editor.state.doc.textContent).toBe("Alpha");
      expect(last("A").evidence).toMatchObject({
        kind: "available",
        value: { dispatchOrigin: { kind: "available", value: { root: { kind: "local" } } } },
      });
      const received = last("B");
      expect(received.record.docChanged).toBe(true);
      expect(received.evidence).toMatchObject({
        kind: "available",
        value: { dispatchOrigin: { kind: "available", value: { root: { kind: "remote-yjs" } } } },
      });
      expect(readDispatchEffects(received.record).map(({ effect }) => effect)).toContainEqual(
        expect.objectContaining({ badge: "Remote · Yjs", listLabel: expect.any(String) }),
      );
      expect(readDispatchEffects(last("A").record).map(({ effect }) => effect)).toContainEqual(
        expect.objectContaining({ badge: "Local · Yjs" }),
      );

      expect(a.editor.commands.undo()).toBe(true);
      expect(b.editor.state.doc.textContent).toBe("");
      expect(last("A").evidence).toMatchObject({
        value: {
          dispatchOrigin: { kind: "available", value: { root: { kind: "yjs-undo-redo" } } },
        },
      });
      expect(last("B").evidence).toMatchObject({
        value: { dispatchOrigin: { kind: "available", value: { root: { kind: "remote-yjs" } } } },
      });
    } finally {
      disconnect();
    }
  });

  it("leaves the dispatch origin unobserved without the sync plugin key", () => {
    const { a, b, last, disconnect } = pair();
    try {
      a.editor.commands.insertContent("Alpha");
      expect(b.editor.state.doc.textContent).toBe("Alpha");
      const received = last("B");
      expect(received.evidence).toMatchObject({
        kind: "available",
        value: {
          dispatchOrigin: { kind: "unobserved", reason: expect.stringContaining("syncPluginKey") },
        },
      });
      expect(readDispatchEffects(received.record).map(({ effect }) => effect)).toContainEqual(
        expect.objectContaining({ badge: "Yjs sample" }),
      );
    } finally {
      disconnect();
    }
  });
});
