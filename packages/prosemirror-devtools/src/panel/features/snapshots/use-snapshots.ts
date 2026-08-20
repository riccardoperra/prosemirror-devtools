import { createEffect, createSignal, type Accessor } from "solid-js";

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

export function useSnapshots(instance: Accessor<RegisteredProseMirrorInstance>): {
  snapshots: Accessor<readonly SavedSnapshot[]>;
  error: Accessor<string | null>;
  save: () => void;
  importFile: (file: File) => Promise<void>;
  restore: (snapshot: SavedSnapshot) => void;
  remove: (snapshotId: string) => void;
} {
  const [snapshots, setSnapshots] = createSignal<SavedSnapshot[]>(loadSnapshots(instance().id));
  const [error, setError] = createSignal<string | null>(null);

  createEffect<string | undefined>((previousId) => {
    const instanceId = instance().id;
    if (previousId !== undefined && previousId !== instanceId) {
      setSnapshots(loadSnapshots(instanceId));
      setError(null);
    }
    return instanceId;
  });

  const updateSnapshots = (update: (current: SavedSnapshot[]) => SavedSnapshot[]): void => {
    setSnapshots((current) => {
      const next = update(current);
      persistSnapshots(instance().id, next);
      return next;
    });
  };

  const save = (): void => {
    const current = instance();
    const snapshot = createSnapshot(current.id, current.view);
    updateSnapshots((snapshots) => [snapshot, ...snapshots]);
  };

  const importFile = async (file: File): Promise<void> => {
    try {
      const imported = await importSnapshotFile(file, instance());
      updateSnapshots((snapshots) => [imported, ...snapshots]);
      setError(null);
    } catch (importError) {
      setError(errorMessage(importError));
    }
  };

  const restore = (snapshot: SavedSnapshot): void => {
    try {
      restoreSnapshot(instance().view, snapshot);
      setError(null);
    } catch (restoreError) {
      setError(errorMessage(restoreError));
    }
  };

  const remove = (snapshotId: string): void => {
    updateSnapshots((current) => current.filter((snapshot) => snapshot.id !== snapshotId));
  };

  return { snapshots, error, save, importFile, restore, remove };
}
