import type { DevtoolsStore } from "prosemirror-inspector/core";

export type Peer = "A" | "B";
export const peers: readonly Peer[] = ["A", "B"];

export const commandLabels = {
  undo: "Undo",
  redo: "Redo",
  sample: "Insert sample",
} satisfies Record<string, string>;
export type DemoCommand = keyof typeof commandLabels;
export const commands = ["undo", "redo", "sample"] satisfies readonly DemoCommand[];

export interface CollaborationFixture {
  flush(): void;
  runCommand(peer: Peer, command: DemoCommand): void;
  setPaused(peer: Peer, paused: boolean): void;
  status(): string;
  dispose(): void;
}

export interface FixtureOptions {
  readonly containers: Readonly<Record<Peer, HTMLDivElement>>;
  readonly store: DevtoolsStore;
  readonly changed: () => void;
  readonly queued: () => void;
  readonly instrumentPlugins: boolean;
}
