import { For, Show, type JSX } from "solid-js";

import { panelStyles } from "../../styles";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { Badge } from "../../ui/badge";
import { downloadSnapshot } from "./snapshot-files";
import { useSnapshots } from "./use-snapshots";

export interface SnapshotsViewProps {
  instance: RegisteredProseMirrorInstance;
}

export function SnapshotsView(props: SnapshotsViewProps): JSX.Element {
  const { snapshots, error, save, importFile, restore, remove } = useSnapshots(
    () => props.instance,
  );
  let input: HTMLInputElement | undefined;

  return (
    <div class={panelStyles.pmScroll}>
      <div class={panelStyles.pmPaneHeader}>
        <span class={panelStyles.pmPaneTitle}>Local snapshots</span>
        <Badge>{snapshots().length}</Badge>
        <span class={panelStyles.pmSpacer} />
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
        <button class={panelStyles.pmButton} onClick={() => input?.click()} type="button">
          Import
        </button>
        <button class={panelStyles.pmButton} data-variant="primary" onClick={save} type="button">
          Save current
        </button>
      </div>
      <Show when={error()}>
        {(message) => <div class={panelStyles.pmWarning}>{message()}</div>}
      </Show>
      <Show
        when={snapshots().length > 0}
        fallback={
          <div class={panelStyles.pmEmpty}>
            Save the current document to compare or restore it later.
          </div>
        }
      >
        <div class={panelStyles.pmSnapshotGrid}>
          <For each={snapshots()}>
            {(snapshot) => (
              <article class={panelStyles.pmSnapshotCard}>
                <div class={panelStyles.pmRowTitle}>{snapshot.name}</div>
                <div class={panelStyles.pmRowDetail}>
                  {new Date(snapshot.createdAt).toLocaleString()}
                </div>
                <div class={panelStyles.pmSnapshotActions}>
                  <button
                    class={panelStyles.pmButton}
                    onClick={() => restore(snapshot)}
                    type="button"
                  >
                    Restore
                  </button>
                  <button
                    class={panelStyles.pmIconButton}
                    onClick={(event) =>
                      downloadSnapshot(snapshot, event.currentTarget.ownerDocument)
                    }
                    title="Export JSON"
                    type="button"
                  >
                    ⇩
                  </button>
                  <span class={panelStyles.pmSpacer} />
                  <button
                    class={panelStyles.pmIconButton}
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
