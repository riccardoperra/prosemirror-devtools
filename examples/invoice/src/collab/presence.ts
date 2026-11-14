import { relativePositionToAbsolutePosition, ySyncPluginKey } from "@tiptap/y-tiptap";
import type { EditorState } from "prosemirror-state";
import * as Y from "yjs";

import type { SpotlightRange } from "../invoice/plugins/spotlight";
import type { CollabPeer } from "./session";

export interface PeerRange {
  readonly anchor: number;
  readonly head: number;
}

/**
 * Where a peer's caret or selection sits in this tab's document. This tab reads its own selection.
 * Others publish Yjs relative positions, mapped the way CollaborationCaret maps them.
 */
export function peerRange(state: EditorState, peer: CollabPeer): PeerRange | null {
  if (peer.self) return { anchor: state.selection.anchor, head: state.selection.head };
  const sync = ySyncPluginKey.getState(state);
  if (!peer.cursor || !sync?.binding) return null;
  const resolve = (json: unknown) =>
    relativePositionToAbsolutePosition(
      sync.doc,
      sync.type,
      Y.createRelativePositionFromJSON(json),
      sync.binding.mapping,
    );
  const anchor = resolve(peer.cursor.anchor);
  const head = resolve(peer.cursor.head);
  if (anchor === null || head === null) return null;
  const size = state.doc.content.size;
  return { anchor: Math.min(anchor, size), head: Math.min(head, size) };
}

function pageAt(state: EditorState, pos: number): number {
  return state.doc.resolve(pos).index(0) + 1;
}

export function peerStatus(state: EditorState, peer: CollabPeer): string {
  if (peer.self) return "This tab";
  const range = peerRange(state, peer);
  if (!range) return "Not in the document yet";
  const page = pageAt(state, range.head);
  if (!peer.cursor?.focused) return `Away, last on page ${page}`;
  return range.anchor === range.head ? `Editing page ${page}` : `Selecting on page ${page}`;
}

/** A selection lights up as text. A caret lights up its whole block, which is easier to spot. */
export function peerSpotlight(state: EditorState, range: PeerRange): SpotlightRange | null {
  const from = Math.min(range.anchor, range.head);
  const to = Math.max(range.anchor, range.head);
  if (from < to) return { kind: "text", from, to };
  const $pos = state.doc.resolve(from);
  if ($pos.depth === 0) return null;
  return { kind: "node", from: $pos.before(), to: $pos.after() };
}
