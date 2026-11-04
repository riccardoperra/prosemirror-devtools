import { Mark } from "prosemirror-model";
import { Selection, type Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { serializeDocument } from "./serialize";
import type { SavedSnapshot, SerializedValue } from "./types";

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = `prosemirror-devtools:snapshots:v${STORAGE_VERSION}:`;
const LEGACY_STORAGE_PREFIX = "prosemirror-devtools:snapshots:";

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function storageFor(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function keyFor(instanceId: string): string {
  return `${STORAGE_PREFIX}${instanceId}`;
}

function legacyKeyFor(instanceId: string): string {
  return `${LEGACY_STORAGE_PREFIX}${instanceId}`;
}

function parseSnapshotList(value: unknown): SavedSnapshot[] | null {
  if (Array.isArray(value)) return value.filter(isSavedSnapshot);
  if (!value || typeof value !== "object") return null;
  return "version" in value &&
    value.version === STORAGE_VERSION &&
    "snapshots" in value &&
    Array.isArray(value.snapshots)
    ? value.snapshots.filter(isSavedSnapshot)
    : null;
}

export function isSerializedValue(value: unknown): value is SerializedValue {
  const pending: unknown[] = [value];
  let visited = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    visited += 1;
    if (visited > 100_000) return false;
    if (
      current === null ||
      typeof current === "string" ||
      typeof current === "boolean" ||
      (typeof current === "number" && Number.isFinite(current))
    ) {
      continue;
    }
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    if (current && typeof current === "object") {
      pending.push(...Object.values(current));
      continue;
    }
    return false;
  }
  return true;
}

export function isSerializedDocument(value: unknown): value is SerializedValue {
  return (
    isSerializedValue(value) &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value === "object" &&
    typeof value.type === "string"
  );
}

export function isSavedSnapshot(value: unknown): value is SavedSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "instanceId" in value &&
    typeof value.instanceId === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "number" &&
    Number.isFinite(value.createdAt) &&
    "doc" in value &&
    isSerializedDocument(value.doc) &&
    "selection" in value &&
    isSerializedValue(value.selection)
  );
}

export function loadSnapshots(instanceId: string, storage?: Storage): SavedSnapshot[] {
  const target = storageFor(storage);
  if (!target) return [];
  try {
    const current = target.getItem(keyFor(instanceId));
    if (current !== null) {
      return parseSnapshotList(JSON.parse(current) as unknown) ?? [];
    }

    const legacyKey = legacyKeyFor(instanceId);
    const legacy = target.getItem(legacyKey);
    if (legacy === null) return [];
    const migrated = parseSnapshotList(JSON.parse(legacy) as unknown) ?? [];
    try {
      target.setItem(
        keyFor(instanceId),
        JSON.stringify({ version: STORAGE_VERSION, snapshots: migrated }),
      );
      target.removeItem(legacyKey);
    } catch {
      // Migration writes are best effort; a readable legacy snapshot remains useful.
    }
    return migrated;
  } catch {
    return [];
  }
}

export function persistSnapshots(
  instanceId: string,
  snapshots: readonly SavedSnapshot[],
  storage?: Storage,
): void {
  const target = storageFor(storage);
  if (!target) return;
  try {
    target.setItem(keyFor(instanceId), JSON.stringify({ version: STORAGE_VERSION, snapshots }));
  } catch {
    // Storage may be unavailable, private, or above quota. Keeping the in-memory
    // snapshot is still useful, so persistence failures remain non-fatal.
  }
}

export function createSnapshot(
  instanceId: string,
  view: EditorView,
  name = new Date().toLocaleString(),
): SavedSnapshot {
  return {
    id: createId(),
    instanceId,
    name,
    createdAt: Date.now(),
    doc: serializeDocument(view.state.doc),
    selection: view.state.selection.toJSON(),
  };
}

export function restoreDocument(
  view: EditorView,
  doc: SerializedValue,
  selection?: SerializedValue,
): void {
  view.dispatch(prepareDocumentRestore(view, doc, selection).transaction.scrollIntoView());
}

export function prepareDocumentRestore(
  view: EditorView,
  doc: SerializedValue,
  selection?: SerializedValue,
): { transaction: Transaction; selectionRestored: boolean } {
  const nextDoc = view.state.schema.nodeFromJSON(doc);
  if (nextDoc.type !== view.state.schema.topNodeType) {
    throw new Error(
      `Expected a ${view.state.schema.topNodeType.name} document, received ${nextDoc.type.name}.`,
    );
  }
  nextDoc.check();
  if (!Mark.sameSet(nextDoc.marks, view.state.doc.marks)) {
    throw new Error("Document-level marks cannot be changed by a snapshot restore transaction.");
  }
  let transaction = view.state.tr.replaceWith(0, view.state.doc.content.size, nextDoc.content);
  for (const [attribute, value] of Object.entries(nextDoc.attrs)) {
    transaction = transaction.setDocAttribute(attribute, value);
  }
  let selectionRestored = false;
  if (selection && typeof selection === "object" && !Array.isArray(selection)) {
    try {
      transaction = transaction.setSelection(Selection.fromJSON(transaction.doc, selection));
      selectionRestored = true;
    } catch {
      // A stale selection should not prevent restoring a valid document.
    }
  }
  return { transaction, selectionRestored };
}

export function restoreSnapshot(view: EditorView, snapshot: SavedSnapshot): void {
  restoreDocument(view, snapshot.doc, snapshot.selection);
}

export type SnapshotDifference =
  | { kind: "added"; path: string; after: SerializedValue }
  | { kind: "removed"; path: string; before: SerializedValue }
  | { kind: "changed"; path: string; before: SerializedValue; after: SerializedValue };

export function compareSnapshots(
  before: Pick<SavedSnapshot, "doc" | "selection">,
  after: Pick<SavedSnapshot, "doc" | "selection">,
  limit = 200,
): { differences: readonly SnapshotDifference[]; truncated: boolean } {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error("Snapshot comparison limit must be a positive integer.");
  const differences: SnapshotDifference[] = [];
  let truncated = false;
  const add = (difference: SnapshotDifference): void => {
    if (differences.length < limit) differences.push(difference);
    else truncated = true;
  };
  const visit = (previous: SerializedValue, next: SerializedValue, path: string): void => {
    if (previous === next || truncated) return;
    if (
      previous !== null &&
      next !== null &&
      typeof previous === "object" &&
      typeof next === "object" &&
      Array.isArray(previous) === Array.isArray(next)
    ) {
      const left = Object.entries(previous);
      const right = new Map(Object.entries(next));
      const segment = (key: string): string =>
        `${path}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`;
      for (const [key, value] of left) {
        const nextValue = right.get(key);
        if (nextValue === undefined) add({ kind: "removed", path: segment(key), before: value });
        else visit(value, nextValue, segment(key));
        right.delete(key);
        if (truncated) return;
      }
      for (const [key, value] of right) {
        add({ kind: "added", path: segment(key), after: value });
        if (truncated) return;
      }
      return;
    }
    add({ kind: "changed", path, before: previous, after: next });
  };
  visit(before.doc, after.doc, "/doc");
  visit(before.selection, after.selection, "/selection");
  return { differences, truncated };
}
