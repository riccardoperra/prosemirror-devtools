import { Editor, Extension } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import StarterKit from "@tiptap/starter-kit";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
import * as Y from "yjs";
import {
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
} from "prosemirror-inspector/tiptap";
import { createTransportObserver } from "prosemirror-inspector/inspectors/transport";
import { createYjsInspector, type YjsInspector } from "prosemirror-inspector/inspectors/yjs";

import { peers, type CollaborationFixture, type FixtureOptions, type Peer } from "./types";

export function mountYjs({
  containers,
  store,
  changed,
  queued,
}: FixtureOptions): CollaborationFixture {
  const docs = { A: new Y.Doc(), B: new Y.Doc() };
  const transport = {
    A: import.meta.env.DEV ? createTransportObserver() : undefined,
    B: import.meta.env.DEV ? createTransportObserver() : undefined,
  };
  const remoteOrigin = { provider: "in-memory-yjs" };
  const pending: {
    readonly from: Peer;
    readonly to: Peer;
    readonly messageId: string;
    readonly update: Uint8Array;
  }[] = [];
  let messageSequence = 0;
  let active = true;
  const createPeer = (peer: Peer) => {
    let inspector: YjsInspector | null = null;
    const native = Extension.create({
      name: "inspector",
      priority: 10000,
      onBeforeCreate() {
        const editor = this.editor;
        inspector = createYjsInspector({
          document: docs[peer],
          ...(transport[peer] ? { transport: transport[peer] } : {}),
          getUndoManager: () => yUndoPluginKey.getState(editor.state)?.undoManager,
          describeOrigin: (origin) =>
            origin === remoteOrigin
              ? "in-memory provider receive"
              : origin === yUndoPluginKey.getState(editor.state)?.undoManager
                ? "local Yjs undo manager"
                : "Unknown Yjs document origin",
        });
        setupTiptapDevtools(editor, {
          id: `yjs-${peer}`,
          label: `Tiptap Yjs ${peer}`,
          store,
          performanceMarks: false,
          captureProfile: "bounded",
          inspectors: [inspector],
        });
      },
      dispatchTransaction(props) {
        dispatchTiptapTransaction(this.editor, props);
      },
      onDestroy() {
        detachTiptapDevtools(this.editor);
        inspector?.dispose();
      },
    });
    return new Editor({
      element: containers[peer],
      extensions: [
        StarterKit.configure({ undoRedo: false, trailingNode: false }),
        Collaboration.configure({ document: docs[peer] }),
        ...(import.meta.env.DEV ? [native] : []),
      ],
      enableExtensionDispatchTransaction: true,
      editorProps: { attributes: { role: "textbox", "aria-label": `Tiptap Yjs editor ${peer}` } },
      onTransaction: changed,
    });
  };
  const editors = { A: createPeer("A"), B: createPeer("B") };
  const disconnect = peers.map((from) => {
    const to = from === "A" ? "B" : "A";
    const listener = (update: Uint8Array, origin: unknown) => {
      if (!active || origin === remoteOrigin) return;
      const messageId = `yjs-${++messageSequence}`;
      transport[from]?.observe({
        kind: "send",
        messageId,
        payload: { kind: "yjs-update", bytes: update.byteLength },
        dispatch: { kind: "unknown" },
      });
      pending.push({ from, to, messageId, update: update.slice() });
      queued();
      changed();
    };
    docs[from].on("update", listener);
    return () => docs[from].off("update", listener);
  });
  const flush = (): void => {
    while (active && pending.length > 0) {
      const message = pending.shift();
      if (!message) break;
      transport[message.to]?.observe({
        kind: "receive",
        messageId: message.messageId,
        payload: { kind: "yjs-update", bytes: message.update.byteLength },
        dispatch: { kind: "unknown" },
      });
      Y.applyUpdate(docs[message.to], message.update, remoteOrigin);
      transport[message.from]?.observe({
        kind: "acknowledge",
        messageId: message.messageId,
        confirmedVersion: null,
        dispatch: { kind: "unknown" },
      });
    }
    changed();
  };
  for (const peer of peers) transport[peer]?.observe({ kind: "connection", state: "connected" });
  editors.A.commands.insertContent("Shared Yjs document.");
  flush();
  for (const peer of peers) yUndoPluginKey.getState(editors[peer].state)?.undoManager.clear();
  return {
    inspectorId: "yjs",
    flush,
    undo(peer) {
      editors[peer].commands.undo();
    },
    setPaused(peer, paused) {
      if (paused) store.pauseCapture(`yjs-${peer}`);
      else store.resumeCapture(`yjs-${peer}`);
    },
    summary: () => ({
      system: "Tiptap Collaboration with Yjs",
      queuedUpdates: pending.length,
      clients: peers.map((peer) => ({
        peer,
        document: editors[peer].state.doc.textContent,
        undoDepth: yUndoPluginKey.getState(editors[peer].state)?.undoManager.undoStack.length ?? 0,
        redoDepth: yUndoPluginKey.getState(editors[peer].state)?.undoManager.redoStack.length ?? 0,
      })),
    }),
    dispose() {
      active = false;
      pending.length = 0;
      for (const dispose of disconnect) dispose();
      for (const peer of peers) {
        editors[peer].destroy();
        docs[peer].destroy();
      }
    },
  };
}
