import { useCallback, useState } from "react";

import {
  createSnapshot,
  loadSnapshots,
  persistSnapshots,
  restoreSnapshot,
} from "../../../core/snapshots";
import type { RegisteredProseMirrorInstance, SavedSnapshot } from "../../../core/types";
import { importSnapshotFile } from "./snapshot-files";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useSnapshots(instance: RegisteredProseMirrorInstance): {
  snapshots: readonly SavedSnapshot[];
  error: string | null;
  save: () => void;
  importFile: (file: File) => Promise<void>;
  restore: (snapshot: SavedSnapshot) => void;
  remove: (snapshotId: string) => void;
} {
  const [snapshots, setSnapshots] = useState<SavedSnapshot[]>(() => loadSnapshots(instance.id));
  const [error, setError] = useState<string | null>(null);

  const updateSnapshots = useCallback(
    (update: (current: SavedSnapshot[]) => SavedSnapshot[]) => {
      setSnapshots((current) => {
        const next = update(current);
        persistSnapshots(instance.id, next);
        return next;
      });
    },
    [instance.id],
  );

  const save = useCallback(() => {
    const snapshot = createSnapshot(instance.id, instance.view);
    updateSnapshots((current) => [snapshot, ...current]);
  }, [instance.id, instance.view, updateSnapshots]);

  const importFile = useCallback(
    async (file: File) => {
      try {
        const imported = await importSnapshotFile(file, instance);
        updateSnapshots((current) => [imported, ...current]);
        setError(null);
      } catch (importError) {
        setError(errorMessage(importError));
      }
    },
    [instance, updateSnapshots],
  );

  const restore = useCallback(
    (snapshot: SavedSnapshot) => {
      try {
        restoreSnapshot(instance.view, snapshot);
        setError(null);
      } catch (restoreError) {
        setError(errorMessage(restoreError));
      }
    },
    [instance.view],
  );

  const remove = useCallback(
    (snapshotId: string) => {
      updateSnapshots((current) => current.filter((snapshot) => snapshot.id !== snapshotId));
    },
    [updateSnapshots],
  );

  return { snapshots, error, save, importFile, restore, remove };
}
