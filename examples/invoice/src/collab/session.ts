import type { AnyExtension, Editor, JSONContent } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
import { Selection } from "prosemirror-state";
import * as Y from "yjs";

import { BroadcastProvider, type ProviderStats } from "./broadcast-provider";
import type { CollabConfig, CollabUser } from "./config";

/** Peers that answer the join handshake do so within a frame or two. */
const handshakeMs = 400;

export interface CollabPeer extends CollabUser {
  readonly clientId: number;
  readonly self: boolean;
}

export interface CollabSnapshot extends ProviderStats {
  readonly room: string;
  readonly peers: readonly CollabPeer[];
}

export interface CollabSession {
  readonly config: CollabConfig;
  readonly doc: Y.Doc;
  readonly provider: BroadcastProvider;
  readonly extensions: readonly AnyExtension[];
  /** Room, peers, and traffic as one immutable value, for useSyncExternalStore. */
  getSnapshot(): CollabSnapshot;
  subscribe(listener: () => void): () => void;
  /** Writes the fixture into the shared document, only from the first peer of an empty room. */
  seed(editor: Editor, content: JSONContent): Promise<void>;
  dispose(): void;
}

function readPeers(provider: BroadcastProvider, clientId: number): CollabPeer[] {
  const peers: CollabPeer[] = [];
  for (const [id, state] of provider.awareness.getStates()) {
    const user = (state as { user?: CollabUser }).user;
    if (user) peers.push({ ...user, clientId: id, self: id === clientId });
  }
  return peers.sort((a, b) => Number(b.self) - Number(a.self) || a.clientId - b.clientId);
}

export function createCollabSession(config: CollabConfig): CollabSession {
  const doc = new Y.Doc();
  const provider = new BroadcastProvider(config.room, doc);
  const listeners = new Set<() => void>();
  let snapshot: CollabSnapshot = { room: config.room, peers: [], ...provider.stats };
  const refresh = (): void => {
    snapshot = { room: config.room, peers: readPeers(provider, doc.clientID), ...provider.stats };
    for (const listener of listeners) listener();
  };
  const stopProvider = provider.subscribe(refresh);
  provider.awareness.on("change", refresh);
  return {
    config,
    doc,
    provider,
    extensions: [
      Collaboration.configure({ document: doc }),
      CollaborationCaret.configure({ provider, user: config.user }),
    ],
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async seed(editor, content) {
      await new Promise((resolve) => setTimeout(resolve, handshakeMs));
      if (editor.isDestroyed || doc.getXmlFragment("default").length > 0) return;
      // Two tabs opened together both find the room empty, so only the lowest client id seeds.
      const lowest = Math.min(...provider.awareness.getStates().keys(), doc.clientID);
      if (lowest !== doc.clientID) return;
      editor.commands.setContent(content);
      // setContent leaves a NodeSelection on the last signature. Start where a single-user tab does.
      editor.view.dispatch(editor.state.tr.setSelection(Selection.atStart(editor.state.doc)));
      yUndoPluginKey.getState(editor.state)?.undoManager.clear();
    },
    dispose() {
      stopProvider();
      provider.awareness.off("change", refresh);
      provider.destroy();
      doc.destroy();
    },
  };
}
