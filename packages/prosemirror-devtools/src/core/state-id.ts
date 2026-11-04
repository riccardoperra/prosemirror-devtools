import type { EditorState } from "prosemirror-state";

const identities = new WeakMap<EditorState, number>();
let nextIdentity = 0;

export function getInspectionStateId(state: EditorState): number {
  const existing = identities.get(state);
  if (existing !== undefined) return existing;
  const identity = ++nextIdentity;
  identities.set(state, identity);
  return identity;
}
