import type { AnyExtension, JSONContent } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { prosemirrorJSONToYXmlFragment } from "@tiptap/y-tiptap";
import type { Schema } from "prosemirror-model";
import * as Y from "yjs";

import { BroadcastProvider, type ProviderStats } from "./broadcast-provider";
import {
  nextFreeUser,
  rememberIdentity,
  userNamed,
  type CollabUser,
  type RoomConfig,
} from "./config";

/**
 * Yjs relative positions as JSON. yCursorPlugin publishes `cursor` while the editor has focus and
 * keeps the last one under `lastSelection`, so a peer in a background tab still has a place.
 */
export interface AwarenessCursor {
  readonly anchor: unknown;
  readonly head: unknown;
  readonly focused: boolean;
}

/** The awareness fields yCursorPlugin writes, keyed by the root fragment name for lastSelection. */
interface CursorFields {
  readonly cursor?: { readonly anchor: unknown; readonly head: unknown } | null;
  readonly lastSelection?: Readonly<
    Record<string, { readonly anchor: unknown; readonly head: unknown } | undefined>
  >;
}

const fragmentName = "default";

function readCursor({ cursor, lastSelection }: CursorFields): AwarenessCursor | null {
  if (cursor) return { anchor: cursor.anchor, head: cursor.head, focused: true };
  const last = lastSelection?.[fragmentName];
  return last ? { anchor: last.anchor, head: last.head, focused: false } : null;
}

/** The user field every tab publishes. joinedAt decides who keeps a name two tabs both claim. */
interface PresenceUser extends CollabUser {
  readonly joinedAt: number;
}

export interface CollabPeer extends PresenceUser {
  readonly clientId: number;
  readonly self: boolean;
  readonly cursor: AwarenessCursor | null;
}

export interface CollabSnapshot extends ProviderStats {
  readonly room: string;
  /** This tab first, then the others in the order they joined. */
  readonly peers: readonly CollabPeer[];
}

export interface CollabSession {
  readonly config: RoomConfig;
  readonly doc: Y.Doc;
  readonly provider: BroadcastProvider;
  readonly extensions: readonly AnyExtension[];
  /** Room, peers, and traffic as one immutable value, for useSyncExternalStore. */
  getSnapshot(): CollabSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

/**
 * Every tab writes the fixture under this one client id, so every tab produces the same Yjs items
 * and merging two seeds is a no-op. A tab can seed before it hears from the room, and two tabs that
 * open together never duplicate the invoice.
 */
const seedClientId = 1;

function seedUpdate(schema: Schema, content: JSONContent): Uint8Array {
  const seed = new Y.Doc();
  seed.clientID = seedClientId;
  prosemirrorJSONToYXmlFragment(schema, content, seed.getXmlFragment(fragmentName));
  const update = Y.encodeStateAsUpdate(seed);
  seed.destroy();
  return update;
}

function readPeers(provider: BroadcastProvider, clientId: number): CollabPeer[] {
  const peers: CollabPeer[] = [];
  for (const [id, state] of provider.awareness.getStates()) {
    const { user, ...fields } = state as CursorFields & { user?: PresenceUser };
    if (user)
      peers.push({ ...user, clientId: id, self: id === clientId, cursor: readCursor(fields) });
  }
  return peers.sort(
    (a, b) => Number(b.self) - Number(a.self) || a.joinedAt - b.joinedAt || a.clientId - b.clientId,
  );
}

/** The earlier of two tabs keeps a shared name. The later one takes the first free name. */
function resolveName(self: CollabPeer, peers: readonly CollabPeer[]): string {
  const others = peers.filter((peer) => !peer.self);
  const earlier = (peer: CollabPeer) =>
    peer.joinedAt < self.joinedAt ||
    (peer.joinedAt === self.joinedAt && peer.clientId < self.clientId);
  const contested = others.some((peer) => peer.name === self.name && earlier(peer));
  return contested ? nextFreeUser(others.map((peer) => peer.name)).name : self.name;
}

export function createCollabSession(
  config: RoomConfig,
  seed: { readonly schema: Schema; readonly content: JSONContent },
): CollabSession {
  const doc = new Y.Doc();
  // Seeded before the provider exists, so the seed never crosses the channel.
  Y.applyUpdate(doc, seedUpdate(seed.schema, seed.content));
  const provider = new BroadcastProvider(config.room, doc);
  const user: PresenceUser = { ...config.user, joinedAt: Date.now() };
  provider.awareness.setLocalStateField("user", user);
  rememberIdentity(config.room, user);
  const listeners = new Set<() => void>();
  const read = (): CollabSnapshot => ({
    room: config.room,
    peers: readPeers(provider, doc.clientID),
    ...provider.stats,
  });
  let snapshot = read();
  const refresh = (): void => {
    snapshot = read();
    const self = snapshot.peers.find((peer) => peer.self);
    const name = self ? resolveName(self, snapshot.peers) : null;
    if (self && name !== null && name !== self.name) {
      const renamed: PresenceUser = { ...userNamed(name), joinedAt: self.joinedAt };
      rememberIdentity(config.room, renamed);
      // Re-enters refresh through the awareness change event with the new name.
      provider.awareness.setLocalStateField("user", renamed);
      return;
    }
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
      CollaborationCaret.configure({ provider, user }),
    ],
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      stopProvider();
      provider.awareness.off("change", refresh);
      provider.destroy();
      doc.destroy();
    },
  };
}
