import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import { panelStyles } from "../../styles";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { compareSnapshots } from "../../../core/snapshots";
import { Badge } from "../../ui/badge";
import { downloadSnapshot } from "./snapshot-files";
import { useSnapshots } from "./use-snapshots";
import { SnapshotComparison } from "./snapshot-comparison";
import { EmptyState } from "../../ui/empty-state";

export interface SnapshotsViewProps {
  instance: RegisteredProseMirrorInstance;
}

export function SnapshotsView(props: SnapshotsViewProps): JSX.Element {
  const {
    snapshots,
    error,
    save,
    importFile,
    preview,
    previewIsCurrent,
    previewRestore,
    confirmRestore,
    cancelRestore,
    remove,
  } = useSnapshots(() => props.instance);
  const [beforeId, setBeforeId] = createSignal("");
  const [afterId, setAfterId] = createSignal("");
  const before = createMemo(() => snapshots().find(({ id }) => id === beforeId()));
  const after = createMemo(() => snapshots().find(({ id }) => id === afterId()));
  const comparison = createMemo(() => {
    const first = before();
    const second = after();
    return first && second ? compareSnapshots(first, second) : undefined;
  });
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
        {(message) => (
          <div role="alert" class={panelStyles.pmWarning}>
            {message()}
          </div>
        )}
      </Show>
      <Show
        when={snapshots().length > 0}
        fallback={
          <EmptyState>Save the current document to compare or restore it later.</EmptyState>
        }
      >
        <div class={panelStyles.pmPaneHeader}>
          <span class={panelStyles.pmPaneTitle}>Compare checkpoints</span>
          <For
            each={[
              { label: "Checkpoint A", value: beforeId, select: setBeforeId },
              { label: "Checkpoint B", value: afterId, select: setAfterId },
            ]}
          >
            {(field) => (
              <label>
                {field.label}{" "}
                <select
                  aria-label={field.label}
                  class={panelStyles.pmInstanceSelect}
                  value={field.value()}
                  onChange={(event) => field.select(event.currentTarget.value)}
                >
                  <option value="">Choose checkpoint</option>
                  <For each={snapshots()}>
                    {(snapshot) => <option value={snapshot.id}>{snapshot.name}</option>}
                  </For>
                </select>
              </label>
            )}
          </For>
        </div>
        <Show when={comparison()}>
          {(value) => (
            <SnapshotComparison comparison={value()} label="Checkpoint A to B differences" />
          )}
        </Show>
        <Show when={preview()}>
          {(value) => (
            <section aria-label="Snapshot restore preview" class={panelStyles.pmDetailBlock}>
              <div class={panelStyles.pmDetailHeading}>
                <span class={panelStyles.pmSectionTitle}>Restore {value().snapshot.name}</span>
              </div>
              <p class={panelStyles.pmPerformanceNote}>
                Target editor {value().target.label} ({value().target.id}). This dispatch replaces
                the document, root attributes, and saved selection. Plugin state, undo history, and
                providers are not replayed.
              </p>
              <Show when={!value().selectionRestored}>
                <p class={panelStyles.pmWarning}>
                  The saved selection is invalid for this document. The restore uses a selection
                  mapped by ProseMirror.
                </p>
              </Show>
              <Show when={!previewIsCurrent()}>
                <p role="status" class={panelStyles.pmWarning}>
                  The editor changed after this preview. Preview the snapshot again before
                  restoring.
                </p>
              </Show>
              <SnapshotComparison
                comparison={value().comparison}
                label="Current editor to checkpoint differences"
              />
              <div class={panelStyles.pmPaneHeader}>
                <button
                  type="button"
                  class={panelStyles.pmButton}
                  disabled={!previewIsCurrent()}
                  onClick={confirmRestore}
                >
                  Restore to {value().target.label}
                </button>
                <button type="button" class={panelStyles.pmButton} onClick={cancelRestore}>
                  Cancel restore
                </button>
              </div>
            </section>
          )}
        </Show>
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
                    onClick={() => previewRestore(snapshot)}
                    type="button"
                  >
                    Preview restore
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
