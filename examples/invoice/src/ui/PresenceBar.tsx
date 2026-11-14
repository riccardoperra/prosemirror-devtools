import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

import { collabUrl, nextFreeUser } from "../collab/config";
import { peerRange, peerSpotlight, peerStatus } from "../collab/presence";
import type { CollabPeer, CollabSession } from "../collab/session";
import { revealPeer } from "../invoice/commands";

/** Matches the avatar exit transition in style.css. */
const exitMs = 160;

interface Departed {
  readonly peer: CollabPeer;
  readonly index: number;
}

/** Keeps a leaving avatar mounted for its exit transition, in the slot it held. */
function useWithDeparted(peers: readonly CollabPeer[]) {
  const [departed, setDeparted] = useState<readonly Departed[]>([]);
  const previous = useRef(peers);
  useEffect(() => {
    const present = new Set(peers.map((peer) => peer.clientId));
    const gone = previous.current
      .map((peer, index) => ({ peer, index }))
      .filter(({ peer }) => !present.has(peer.clientId));
    previous.current = peers;
    if (gone.length === 0) return;
    setDeparted((current) => [...current, ...gone]);
    // No cleanup: a later presence change must not cancel this removal.
    setTimeout(
      () => setDeparted((current) => current.filter((entry) => !gone.includes(entry))),
      exitMs,
    );
  }, [peers]);
  const rows = peers.map((peer) => ({ peer, leaving: false }));
  for (const { peer, index } of departed) {
    if (peers.some((current) => current.clientId === peer.clientId)) continue;
    rows.splice(Math.min(index, rows.length), 0, { peer, leaving: true });
  }
  return rows;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function Tip({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} role="tooltip" className="presence-tip">
      {children}
    </span>
  );
}

function Avatar({ editor, peer, leaving }: { editor: Editor; peer: CollabPeer; leaving: boolean }) {
  const tipId = useId();
  // Positions move with every edit, so the status re-reads the current state on each render.
  const status = peerStatus(editor.state, peer);
  const range = peer.self ? null : peerRange(editor.state, peer);
  const spotlight = range ? peerSpotlight(editor.state, range) : null;
  return (
    <li className="presence-avatar" data-leaving={leaving || undefined}>
      <button
        type="button"
        aria-label={peer.self ? `You, ${peer.name}` : `Jump to ${peer.name}`}
        aria-describedby={tipId}
        aria-disabled={!spotlight || undefined}
        data-self={peer.self || undefined}
        style={{ "--peer-color": peer.color } as CSSProperties}
        onClick={() => {
          if (spotlight) revealPeer(editor, spotlight);
        }}
      >
        {initials(peer.name)}
      </button>
      <Tip id={tipId}>
        <strong>
          {peer.name}
          {peer.self ? " (you)" : ""}
        </strong>
        <span>{status}</span>
      </Tip>
    </li>
  );
}

/** Everyone in the room as avatars, an invite for the next free user, and the local-only caveat. */
export function PresenceBar({ editor, collab }: { editor: Editor; collab: CollabSession }) {
  const snapshot = useSyncExternalStore(collab.subscribe, collab.getSnapshot);
  // Remote carets are mapped through the document, so statuses follow edits too.
  useEditorState({ editor, selector: ({ editor: current }) => current.state.doc });
  const rows = useWithDeparted(snapshot.peers);
  const infoId = useId();
  const next = nextFreeUser(snapshot.peers.map((peer) => peer.name));
  const count = snapshot.peers.length;
  return (
    <div className="presence" role="group" aria-label="People in this room">
      <ul className="presence-avatars">
        {rows.map(({ peer, leaving }) => (
          <Avatar key={peer.clientId} editor={editor} peer={peer} leaving={leaving} />
        ))}
      </ul>
      <span className="presence-count" aria-live="polite">
        {count} online
      </span>
      <button
        type="button"
        className="presence-invite"
        title={`Open this room in a new tab as ${next.name}`}
        onClick={() => window.open(collabUrl(location.href, snapshot.room, next.name), "_blank")}
      >
        + Invite
      </button>
      <span className="presence-info">
        <span tabIndex={0} aria-label="About this room" aria-describedby={infoId}>
          i
        </span>
        <Tip id={infoId}>
          <strong>Room {snapshot.room}</strong>
          <span>
            Sync is local to this browser. Tabs share the room over BroadcastChannel, and nothing
            leaves this browser.
          </span>
        </Tip>
      </span>
    </div>
  );
}
