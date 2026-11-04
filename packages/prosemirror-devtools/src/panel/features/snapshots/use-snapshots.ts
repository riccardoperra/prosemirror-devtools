import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";

import {
  createSnapshot,
  loadSnapshots,
  persistSnapshots,
  compareSnapshots,
  prepareDocumentRestore,
  restoreSnapshot,
} from "../../../core/snapshots";
import type { RegisteredProseMirrorInstance, SavedSnapshot } from "../../../core/types";
import { importSnapshotFile } from "./snapshot-files";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SnapshotRestorePreview = Readonly<{
  snapshot: SavedSnapshot;
  target: RegisteredProseMirrorInstance;
  state: RegisteredProseMirrorInstance["view"]["state"];
  comparison: ReturnType<typeof compareSnapshots>;
  selectionRestored: boolean;
}>;

export function useSnapshots(instance: Accessor<RegisteredProseMirrorInstance>): {
  snapshots: Accessor<readonly SavedSnapshot[]>;
  error: Accessor<string | null>;
  save: () => void;
  importFile: (file: File) => Promise<void>;
  preview: Accessor<SnapshotRestorePreview | undefined>;
  previewIsCurrent: Accessor<boolean>;
  previewRestore: (snapshot: SavedSnapshot) => void;
  confirmRestore: () => void;
  cancelRestore: () => void;
  remove: (snapshotId: string) => void;
} {
  const [snapshots, setSnapshots] = createSignal<SavedSnapshot[]>(loadSnapshots(instance().id));
  const [error, setError] = createSignal<string | null>(null);
  const [preview, setPreview] = createSignal<SnapshotRestorePreview>();
  let disposed = false;
  const previewIsCurrent = (): boolean => {
    const current = preview();
    const target = instance();
    return (
      !!current &&
      !disposed &&
      target.id === current.target.id &&
      target.view === current.target.view &&
      target.view.state === current.state
    );
  };
  onCleanup(() => {
    disposed = true;
  });

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
    const target = instance();
    const isCurrent = (): boolean =>
      !disposed && instance().id === target.id && instance().view === target.view;
    try {
      const imported = await importSnapshotFile(file, target);
      if (!isCurrent()) return;
      updateSnapshots((snapshots) => [imported, ...snapshots]);
      setError(null);
    } catch (importError) {
      if (!isCurrent()) return;
      setError(errorMessage(importError));
    }
  };

  const previewRestore = (snapshot: SavedSnapshot): void => {
    try {
      const target = instance();
      const state = target.view.state;
      const prepared = prepareDocumentRestore(target.view, snapshot.doc, snapshot.selection);
      setPreview({
        snapshot,
        target,
        state,
        comparison: compareSnapshots(
          { doc: state.doc.toJSON(), selection: state.selection.toJSON() },
          snapshot,
        ),
        selectionRestored: prepared.selectionRestored,
      });
      setError(null);
    } catch (restoreError) {
      setPreview(undefined);
      setError(errorMessage(restoreError));
    }
  };

  const confirmRestore = (): void => {
    const current = preview();
    if (!current || !previewIsCurrent()) {
      setError(
        "The restore target changed after this preview. Preview the snapshot again before restoring.",
      );
      return;
    }
    try {
      restoreSnapshot(current.target.view, current.snapshot);
      setPreview(undefined);
      setError(null);
    } catch (restoreError) {
      setError(errorMessage(restoreError));
    }
  };

  const remove = (snapshotId: string): void => {
    updateSnapshots((current) => current.filter((snapshot) => snapshot.id !== snapshotId));
  };

  return {
    snapshots,
    error,
    save,
    importFile,
    preview,
    previewIsCurrent,
    previewRestore,
    confirmRestore,
    cancelRestore: () => setPreview(undefined),
    remove,
  };
}
