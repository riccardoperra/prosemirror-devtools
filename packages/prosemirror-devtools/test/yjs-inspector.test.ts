import { Editor, Extension } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import StarterKit from "@tiptap/starter-kit";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
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
