import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import type {
  AppliedTransactionRecord,
  DevtoolsMarker,
  TransactionRecord,
} from "../../../core/types";

import { panelStyles } from "../../styles";
import { formatMs } from "../../formatters";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";

interface AppliedTransactionProps {
  transaction: AppliedTransactionRecord;
}

function AppliedTransaction(props: AppliedTransactionProps): JSX.Element {
  const [open, setOpen] = createSignal(props.transaction.index === 0);

  return (
    <details
      class={panelStyles.pmTransactionRecord}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open()}
    >
      <summary>
        <span class={panelStyles.pmTransactionKind}>
          {props.transaction.appended ? "Appended" : "Root"}
        </span>
        <strong>Transaction {props.transaction.index + 1}</strong>
        <span class={panelStyles.pmSpacer} />
        <Show when={props.transaction.docChanged}>
          <Badge tone="green">doc</Badge>
        </Show>
        <Show when={props.transaction.selectionSet}>
          <Badge tone="blue">selection</Badge>
        </Show>
        <Show when={props.transaction.storedMarksSet}>
          <Badge>marks</Badge>
        </Show>
        <span class={panelStyles.pmRowDetail}>
          {props.transaction.steps.length} {props.transaction.steps.length === 1 ? "step" : "steps"}
        </span>
      </summary>
      <Show when={open()}>
        <div class={panelStyles.pmTransactionPayload}>
          <section>
            <div class={panelStyles.pmDetailHeading}>
              <span class={panelStyles.pmSectionTitle}>Steps</span>
              <Badge>{props.transaction.steps.length}</Badge>
            </div>
            <JsonTree defaultExpandedDepth={4} value={props.transaction.steps} />
          </section>
          <section>
            <div class={panelStyles.pmDetailHeading}>
              <span class={panelStyles.pmSectionTitle}>Metadata</span>
              <Badge>{Object.keys(props.transaction.meta).length}</Badge>
            </div>
            <JsonTree defaultExpandedDepth={4} value={props.transaction.meta} />
          </section>
        </div>
      </Show>
    </details>
  );
}

export interface AppliedTransactionsProps {
  record: TransactionRecord;
}

export function AppliedTransactions(props: AppliedTransactionsProps): JSX.Element {
  return (
    <Show
      when={props.record.transactions.length > 0}
      fallback={
        <div class={panelStyles.pmInspectorEmpty}>
          {props.record.filtered
            ? "The root transaction was filtered before it could be applied."
            : "No applied transaction payload was observed for this dispatch."}
        </div>
      }
    >
      <div class={panelStyles.pmTransactionStack}>
        <For each={props.record.transactions}>
          {(transaction) => <AppliedTransaction transaction={transaction} />}
        </For>
      </div>
    </Show>
  );
}

export interface DispatchDocumentsProps {
  record: TransactionRecord;
}

export function DispatchDocuments(props: DispatchDocumentsProps): JSX.Element {
  const [open, setOpen] = createSignal(false);

  return (
    <>
      <section class={panelStyles.pmSelectionDetail}>
        <div class={panelStyles.pmDetailHeading}>
          <span class={panelStyles.pmSectionTitle}>Selection</span>
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
        class={panelStyles.pmDocumentDisclosure}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        open={open()}
      >
        <summary>
          <span class={panelStyles.pmSectionTitle}>Documents</span>
          <span class={panelStyles.pmRowDetail}>Before and after JSON</span>
        </summary>
        <Show when={open()}>
          <div class={panelStyles.pmDetailColumns}>
            <section>
              <div class={panelStyles.pmDetailHeading}>
                <span class={panelStyles.pmSectionTitle}>Before</span>
              </div>
              <JsonTree defaultExpandedDepth={2} value={props.record.docBefore} />
            </section>
            <section>
              <div class={panelStyles.pmDetailHeading}>
                <span class={panelStyles.pmSectionTitle}>After</span>
              </div>
              <JsonTree defaultExpandedDepth={2} value={props.record.docAfter} />
            </section>
          </div>
        </Show>
      </details>
    </>
  );
}

export interface DispatchMarkersProps {
  markers: readonly DevtoolsMarker[];
}

export function DispatchMarkers(props: DispatchMarkersProps): JSX.Element {
  const orderedMarkers = createMemo(() =>
    [...props.markers].sort((left, right) => left.startOffset - right.startOffset),
  );

  return (
    <Show when={orderedMarkers().length > 0}>
      <section aria-label="Custom markers" class={panelStyles.pmMarkerSection}>
        <div class={panelStyles.pmWorkspaceHeading}>
          <span class={panelStyles.pmSectionTitle}>Markers</span>
          <Badge>{orderedMarkers().length}</Badge>
        </div>
        <For each={orderedMarkers()}>
          {(marker) => (
            <div class={panelStyles.pmMarkerEntry} data-tone={marker.tone}>
              <div class={panelStyles.pmMarkerRow}>
                <i aria-hidden="true" class={panelStyles.pmStatusDot} />
                <span class={panelStyles.pmRowMain}>
                  <span class={panelStyles.pmRowTitle}>{marker.label}</span>
                  <span class={panelStyles.pmRowDetail}>
                    {marker.category ?? "custom"} · at {formatMs(marker.startOffset)}
                  </span>
                </span>
                <span class={panelStyles.pmMono}>
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
