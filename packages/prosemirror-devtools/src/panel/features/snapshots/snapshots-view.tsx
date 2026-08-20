import { For, Show, type JSX } from "solid-js";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { Badge } from "../../ui/badge";
import { downloadSnapshot } from "./snapshot-files";
import { useSnapshots } from "./use-snapshots";

export function SnapshotsView(props: { instance: RegisteredProseMirrorInstance }): JSX.Element {
  const { snapshots, error, save, importFile, restore, remove } = useSnapshots(
    () => props.instance,
  );
  let input: HTMLInputElement | undefined;

  return (
    <div class="pm-scroll">
      <div class="pm-pane-header">
        <span class="pm-pane-title">Local snapshots</span>
        <Badge>{snapshots().length}</Badge>
        <span class="pm-spacer" />
        <input
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void importFile(file);
            event.currentTarget.value = "";
          }}
          ref={(element) => {
            input = element;
          }}
          type="file"
        />
        <button class="pm-button" onClick={() => input?.click()} type="button">
          Import
        </button>
        <button class="pm-button" data-variant="primary" onClick={save} type="button">
          Save current
        </button>
      </div>
      <Show when={error()}>{(message) => <div class="pm-warning">{message()}</div>}</Show>
      <Show
        when={snapshots().length > 0}
        fallback={
          <div class="pm-empty">Save the current document to compare or restore it later.</div>
        }
      >
        <div class="pm-snapshot-grid">
          <For each={snapshots()}>
            {(snapshot) => (
              <article class="pm-snapshot-card">
                <div class="pm-row-title">{snapshot.name}</div>
                <div class="pm-row-detail">{new Date(snapshot.createdAt).toLocaleString()}</div>
                <div class="pm-snapshot-actions">
                  <button class="pm-button" onClick={() => restore(snapshot)} type="button">
                    Restore
                  </button>
                  <button
                    class="pm-icon-button"
                    onClick={(event) =>
                      downloadSnapshot(snapshot, event.currentTarget.ownerDocument)
                    }
                    title="Export JSON"
                    type="button"
                  >
                    ⇩
                  </button>
                  <span class="pm-spacer" />
                  <button
                    class="pm-icon-button"
                    data-variant="danger"
                    onClick={() => remove(snapshot.id)}
                    title="Delete snapshot"
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
