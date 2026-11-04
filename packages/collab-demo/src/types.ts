import type { DevtoolsStore } from "prosemirror-inspector/core";

export type Peer = "A" | "B";
export const peers: readonly Peer[] = ["A", "B"];

export interface CollaborationFixture {
  readonly inspectorId: "prosemirror-collab" | "yjs";
  flush(): void;
  undo(peer: Peer): void;
  setPaused(peer: Peer, paused: boolean): void;
  summary(): unknown;
  dispose(): void;
}

export interface FixtureOptions {
  readonly containers: Readonly<Record<Peer, HTMLDivElement>>;
  readonly store: DevtoolsStore;
  readonly changed: () => void;
  readonly queued: () => void;
}
