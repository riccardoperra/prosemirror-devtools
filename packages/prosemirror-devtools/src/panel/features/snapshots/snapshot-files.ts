import { readInstanceState } from "../../store/instance-state";
import { createSnapshot, isSavedSnapshot, isSerializedDocument } from "../../../core/snapshots";
import type { RegisteredProseMirrorInstance, SavedSnapshot } from "../../../core/types";

export async function importSnapshotFile(
  file: File,
  instance: RegisteredProseMirrorInstance,
): Promise<SavedSnapshot> {
  const parsed = JSON.parse(await file.text()) as unknown;
  const imported: SavedSnapshot = isSavedSnapshot(parsed)
    ? {
        ...parsed,
        id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
        instanceId: instance.id,
      }
    : isSerializedDocument(parsed)
      ? {
          ...createSnapshot(instance.id, instance.view, file.name.replace(/\.json$/i, "")),
          doc: parsed,
        }
      : (() => {
          throw new Error("Expected a ProseMirror document or devtools snapshot JSON file.");
        })();

  const schema = readInstanceState(instance).schema;
  const importedDocument = schema.nodeFromJSON(imported.doc);
  if (importedDocument.type !== schema.topNodeType) {
    throw new Error(
      `Expected a ${schema.topNodeType.name} document, received ${importedDocument.type.name}.`,
    );
  }
  importedDocument.check();

  return imported;
}

export function downloadSnapshot(snapshot: SavedSnapshot, target: Document = document): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }),
  );
  const anchor = target.createElement("a");
  anchor.href = url;
  anchor.download = `${snapshot.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "snapshot"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
