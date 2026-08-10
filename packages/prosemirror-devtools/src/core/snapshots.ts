import type { Node as ProseMirrorNode } from "prosemirror-model";
import { Selection } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { serializeDocument, serializeValue } from "./serialize";
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
  const envelope = value as { version?: unknown; snapshots?: unknown };
  return envelope.version === STORAGE_VERSION && Array.isArray(envelope.snapshots)
    ? envelope.snapshots.filter(isSavedSnapshot)
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
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.instanceId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createdAt === "number" &&
    Number.isFinite(candidate.createdAt) &&
    isSerializedDocument(candidate.doc) &&
    isSerializedValue(candidate.selection)
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
    selection: serializeValue(view.state.selection.toJSON()),
  };
}

export function restoreDocument(
  view: EditorView,
  doc: SerializedValue,
  selection?: SerializedValue,
): void {
  const nextDoc = view.state.schema.nodeFromJSON(doc) as ProseMirrorNode;
  let transaction = view.state.tr.replaceWith(0, view.state.doc.content.size, nextDoc.content);
  if (selection && typeof selection === "object" && !Array.isArray(selection)) {
    try {
      transaction = transaction.setSelection(Selection.fromJSON(transaction.doc, selection));
    } catch {
      // A stale selection should not prevent restoring a valid document.
    }
  }
  view.dispatch(transaction.scrollIntoView());
}

export function restoreSnapshot(view: EditorView, snapshot: SavedSnapshot): void {
  restoreDocument(view, snapshot.doc, snapshot.selection);
}
