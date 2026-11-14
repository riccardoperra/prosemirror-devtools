import { createDiagnosticDemoPlugin } from "@prosemirror-devtools/demo-kit/diagnostic-plugin";
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
import { createProseMirrorDevtoolsDiagnostics } from "prosemirror-inspector/core";
import { createTiptapInspector } from "prosemirror-inspector/inspectors/tiptap";
import { createTransportObserver } from "prosemirror-inspector/inspectors/transport";
import { createYjsInspector, type YjsInspector } from "prosemirror-inspector/inspectors/yjs";

import { textImpactInspector } from "./text-impact";

import {
  commandLabels,
  peers,
  type CollaborationFixture,
  type FixtureOptions,
  type Peer,
} from "./types";
import { devtoolsEnabled } from "./env";

export function mountYjs({
  containers,
  store,
  changed,
  queued,
  instrumentPlugins,
}: FixtureOptions): CollaborationFixture {
  const docs = { A: new Y.Doc(), B: new Y.Doc() };
  const transport = {
    A: devtoolsEnabled ? createTransportObserver() : undefined,
    B: devtoolsEnabled ? createTransportObserver() : undefined,
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
    const diagnostics = devtoolsEnabled ? createProseMirrorDevtoolsDiagnostics() : undefined;
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
          instrumentPlugins,
          ...(diagnostics ? { diagnostics } : {}),
          inspectors: [inspector, createTiptapInspector({ editor }), textImpactInspector],
        });
      },
      dispatchTransaction(props) {
        dispatchTiptapTransaction(this.editor, props);
      },
      onDestroy() {
        detachTiptapDevtools(this.editor);
        inspector?.dispose();
        diagnostics?.dispose();
      },
    });
    const editor = new Editor({
      element: containers[peer],
      extensions: [
        StarterKit.configure({ undoRedo: false, trailingNode: false }),
        Collaboration.configure({ document: docs[peer] }),
        Extension.create({
          name: "demoVisuals",
          addProseMirrorPlugins: () => [createDiagnosticDemoPlugin({ blockExamples: true })],
        }),
        ...(devtoolsEnabled ? [native] : []),
      ],
      enableExtensionDispatchTransaction: true,
      editorProps: { attributes: { role: "textbox", "aria-label": `Tiptap Yjs editor ${peer}` } },
      onTransaction: changed,
    });
    return { editor, diagnostics };
  };
  const clients = { A: createPeer("A"), B: createPeer("B") };
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
  clients.A.editor.commands.insertContent("Shared Yjs document.");
  flush();
  for (const peer of peers)
    yUndoPluginKey.getState(clients[peer].editor.state)?.undoManager.clear();
  return {
    inspectorId: "yjs",
    flush,
    runCommand(peer, command) {
      if (command === "sampleExcluded") return;
      const { editor, diagnostics } = clients[peer];
      const run = () => {
        if (command !== "sample") return editor.commands[command]();
        const { $from } = editor.state.selection;
        const at = $from.parent.isTextblock ? $from.end() : $from.pos;
        return editor.commands.insertContentAt(at, ` Sample from peer ${peer}.`);
      };
      if (diagnostics) diagnostics.traceCommand(commandLabels[command], run);
      else run();
    },
    setPaused(peer, paused) {
      if (paused) store.pauseCapture(`yjs-${peer}`);
      else store.resumeCapture(`yjs-${peer}`);
    },
    status: () => `Yjs updates waiting for delivery · ${pending.length}.`,
    dispose() {
      active = false;
      pending.length = 0;
      for (const dispose of disconnect) dispose();
      for (const peer of peers) {
        clients[peer].editor.destroy();
        docs[peer].destroy();
      }
    },
  };
}
