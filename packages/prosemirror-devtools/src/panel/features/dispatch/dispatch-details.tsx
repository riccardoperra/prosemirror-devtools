import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import type {
  AppliedTransactionRecord,
  DevtoolsMarker,
  TransactionRecord,
} from "../../../core/types";
import { formatMs } from "../../formatters";
import { JsonTree } from "../../json-tree";
import { Badge } from "../../ui/badge";

function AppliedTransaction({
  transaction,
}: {
  transaction: AppliedTransactionRecord;
}): ReactElement {
  const [open, setOpen] = useState(transaction.index === 0);

  return (
    <details
      className="pm-transaction-record"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary>
        <span className="pm-transaction-kind">{transaction.appended ? "Appended" : "Root"}</span>
        <strong>Transaction {transaction.index + 1}</strong>
        <span className="pm-spacer" />
        {transaction.docChanged ? <Badge tone="green">doc</Badge> : null}
        {transaction.selectionSet ? <Badge tone="blue">selection</Badge> : null}
        {transaction.storedMarksSet ? <Badge>marks</Badge> : null}
        <span className="pm-row-detail">
          {transaction.steps.length} {transaction.steps.length === 1 ? "step" : "steps"}
        </span>
      </summary>
      <div className="pm-transaction-payload">
        <section>
          <div className="pm-detail-heading">
            <span className="pm-section-title">Steps</span>
            <Badge>{transaction.steps.length}</Badge>
          </div>
          <JsonTree defaultExpandedDepth={4} value={transaction.steps} />
        </section>
        <section>
          <div className="pm-detail-heading">
            <span className="pm-section-title">Metadata</span>
            <Badge>{Object.keys(transaction.meta).length}</Badge>
          </div>
          <JsonTree defaultExpandedDepth={4} value={transaction.meta} />
        </section>
      </div>
    </details>
  );
}

export function AppliedTransactions({ record }: { record: TransactionRecord }): ReactElement {
  if (record.transactions.length === 0) {
    return (
      <div className="pm-inspector-empty">
        {record.filtered
          ? "The root transaction was filtered before it could be applied."
          : "No applied transaction payload was observed for this dispatch."}
      </div>
    );
  }

  return (
    <div className="pm-transaction-stack">
      {record.transactions.map((transaction) => (
        <AppliedTransaction key={`${record.id}-${transaction.index}`} transaction={transaction} />
      ))}
    </div>
  );
}

export function DispatchDocuments({ record }: { record: TransactionRecord }): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="pm-selection-detail">
        <div className="pm-detail-heading">
          <span className="pm-section-title">Selection</span>
        </div>
        <JsonTree
          defaultExpandedDepth={4}
          value={{ before: record.selectionBefore, after: record.selectionAfter }}
        />
      </section>
      <details
        className="pm-document-disclosure"
        onToggle={(event) => setOpen(event.currentTarget.open)}
        open={open}
      >
        <summary>
          <span className="pm-section-title">Documents</span>
          <span className="pm-row-detail">Before and after JSON</span>
        </summary>
        <div className="pm-detail-columns">
          <section>
            <div className="pm-detail-heading">
              <span className="pm-section-title">Before</span>
            </div>
            <JsonTree defaultExpandedDepth={2} value={record.docBefore} />
          </section>
          <section>
            <div className="pm-detail-heading">
              <span className="pm-section-title">After</span>
            </div>
            <JsonTree defaultExpandedDepth={2} value={record.docAfter} />
          </section>
        </div>
      </details>
    </>
  );
}

export function DispatchMarkers({
  markers,
}: {
  markers: readonly DevtoolsMarker[];
}): ReactElement | null {
  const orderedMarkers = useMemo(
    () => [...markers].sort((left, right) => left.startOffset - right.startOffset),
    [markers],
  );

  if (orderedMarkers.length === 0) return null;

  return (
    <section aria-label="Custom markers" className="pm-marker-section">
      <div className="pm-workspace-heading">
        <span className="pm-section-title">Markers</span>
        <Badge>{orderedMarkers.length}</Badge>
      </div>
      {orderedMarkers.map((marker, index) => (
        <div className="pm-marker-entry" data-tone={marker.tone} key={`${index}-${marker.label}`}>
          <div className="pm-marker-row">
            <i aria-hidden="true" className="pm-status-dot" />
            <span className="pm-row-main">
              <span className="pm-row-title">{marker.label}</span>
              <span className="pm-row-detail">
                {marker.category ?? "custom"} · at {formatMs(marker.startOffset)}
              </span>
            </span>
            <span className="pm-mono">
              {marker.duration == null ? "point" : formatMs(marker.duration)}
            </span>
          </div>
          {marker.data !== undefined ? (
            <JsonTree defaultExpandedDepth={4} value={marker.data} />
          ) : null}
        </div>
      ))}
    </section>
  );
}
