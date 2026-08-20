import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import type {
  AppliedTransactionRecord,
  DevtoolsMarker,
  TransactionRecord,
} from "../../../core/types";
import { formatMs } from "../../formatters";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";

function AppliedTransaction(props: { transaction: AppliedTransactionRecord }): JSX.Element {
  const [open, setOpen] = createSignal(props.transaction.index === 0);

  return (
    <details
      class="pm-transaction-record"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open()}
    >
      <summary>
        <span class="pm-transaction-kind">{props.transaction.appended ? "Appended" : "Root"}</span>
        <strong>Transaction {props.transaction.index + 1}</strong>
        <span class="pm-spacer" />
        <Show when={props.transaction.docChanged}>
          <Badge tone="green">doc</Badge>
        </Show>
        <Show when={props.transaction.selectionSet}>
          <Badge tone="blue">selection</Badge>
        </Show>
        <Show when={props.transaction.storedMarksSet}>
          <Badge>marks</Badge>
        </Show>
        <span class="pm-row-detail">
          {props.transaction.steps.length} {props.transaction.steps.length === 1 ? "step" : "steps"}
        </span>
      </summary>
      <div class="pm-transaction-payload">
        <section>
          <div class="pm-detail-heading">
            <span class="pm-section-title">Steps</span>
            <Badge>{props.transaction.steps.length}</Badge>
          </div>
          <JsonTree defaultExpandedDepth={4} value={props.transaction.steps} />
        </section>
        <section>
          <div class="pm-detail-heading">
            <span class="pm-section-title">Metadata</span>
            <Badge>{Object.keys(props.transaction.meta).length}</Badge>
          </div>
          <JsonTree defaultExpandedDepth={4} value={props.transaction.meta} />
        </section>
      </div>
    </details>
  );
}

export function AppliedTransactions(props: { record: TransactionRecord }): JSX.Element {
  return (
    <Show
      when={props.record.transactions.length > 0}
      fallback={
        <div class="pm-inspector-empty">
          {props.record.filtered
            ? "The root transaction was filtered before it could be applied."
            : "No applied transaction payload was observed for this dispatch."}
        </div>
      }
    >
      <div class="pm-transaction-stack">
        <For each={props.record.transactions}>
          {(transaction) => <AppliedTransaction transaction={transaction} />}
        </For>
      </div>
    </Show>
  );
}

export function DispatchDocuments(props: { record: TransactionRecord }): JSX.Element {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <section class="pm-selection-detail">
        <div class="pm-detail-heading">
          <span class="pm-section-title">Selection</span>
        </div>
        <JsonTree
          defaultExpandedDepth={4}
          value={{
            before: props.record.selectionBefore,
            after: props.record.selectionAfter,
          }}
        />
      </section>
      <details
        class="pm-document-disclosure"
        onToggle={(event) => setOpen(event.currentTarget.open)}
        open={open()}
      >
        <summary>
          <span class="pm-section-title">Documents</span>
          <span class="pm-row-detail">Before and after JSON</span>
        </summary>
        <div class="pm-detail-columns">
          <section>
            <div class="pm-detail-heading">
              <span class="pm-section-title">Before</span>
            </div>
            <JsonTree defaultExpandedDepth={2} value={props.record.docBefore} />
          </section>
          <section>
            <div class="pm-detail-heading">
              <span class="pm-section-title">After</span>
            </div>
            <JsonTree defaultExpandedDepth={2} value={props.record.docAfter} />
          </section>
        </div>
      </details>
    </>
  );
}

export function DispatchMarkers(props: { markers: readonly DevtoolsMarker[] }): JSX.Element {
  const orderedMarkers = createMemo(() =>
    [...props.markers].sort((left, right) => left.startOffset - right.startOffset),
  );

  return (
    <Show when={orderedMarkers().length > 0}>
      <section aria-label="Custom markers" class="pm-marker-section">
        <div class="pm-workspace-heading">
          <span class="pm-section-title">Markers</span>
          <Badge>{orderedMarkers().length}</Badge>
        </div>
        <For each={orderedMarkers()}>
          {(marker) => (
            <div class="pm-marker-entry" data-tone={marker.tone}>
              <div class="pm-marker-row">
                <i aria-hidden="true" class="pm-status-dot" />
                <span class="pm-row-main">
                  <span class="pm-row-title">{marker.label}</span>
                  <span class="pm-row-detail">
                    {marker.category ?? "custom"} · at {formatMs(marker.startOffset)}
                  </span>
                </span>
                <span class="pm-mono">
                  {marker.duration == null ? "point" : formatMs(marker.duration)}
                </span>
              </div>
              <Show when={marker.data !== undefined}>
                <JsonTree defaultExpandedDepth={4} value={marker.data} />
              </Show>
            </div>
          )}
        </For>
      </section>
    </Show>
  );
}
