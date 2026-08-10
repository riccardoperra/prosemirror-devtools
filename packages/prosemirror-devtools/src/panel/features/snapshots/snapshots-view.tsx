import { useRef } from "react";
import type { ReactElement } from "react";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { Badge } from "../../ui/badge";
import { downloadSnapshot } from "./snapshot-files";
import { useSnapshots } from "./use-snapshots";

export function SnapshotsView({
  instance,
}: {
  instance: RegisteredProseMirrorInstance;
}): ReactElement {
  const { snapshots, error, save, importFile, restore, remove } = useSnapshots(instance);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="pm-scroll">
      <div className="pm-pane-header">
        <span className="pm-pane-title">Local snapshots</span>
        <Badge>{snapshots.length}</Badge>
        <span className="pm-spacer" />
        <input
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
            event.currentTarget.value = "";
          }}
          ref={inputRef}
          type="file"
        />
        <button className="pm-button" onClick={() => inputRef.current?.click()} type="button">
          Import
        </button>
        <button className="pm-button" data-variant="primary" onClick={save} type="button">
          Save current
        </button>
      </div>
      {error ? <div className="pm-warning">{error}</div> : null}
      {snapshots.length === 0 ? (
        <div className="pm-empty">Save the current document to compare or restore it later.</div>
      ) : (
        <div className="pm-snapshot-grid">
          {snapshots.map((snapshot) => (
            <article className="pm-snapshot-card" key={snapshot.id}>
              <div className="pm-row-title">{snapshot.name}</div>
              <div className="pm-row-detail">{new Date(snapshot.createdAt).toLocaleString()}</div>
              <div className="pm-snapshot-actions">
                <button className="pm-button" onClick={() => restore(snapshot)} type="button">
                  Restore
                </button>
                <button
                  className="pm-icon-button"
                  onClick={(event) => downloadSnapshot(snapshot, event.currentTarget.ownerDocument)}
                  title="Export JSON"
                  type="button"
                >
                  ⇩
                </button>
                <span className="pm-spacer" />
                <button
                  className="pm-icon-button"
                  data-variant="danger"
                  onClick={() => remove(snapshot.id)}
                  title="Delete snapshot"
                  type="button"
                >
                  ×
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
