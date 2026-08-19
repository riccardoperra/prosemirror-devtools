import { createContext, use, useCallback, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { restoreDocument } from "../../../core/snapshots";
import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../core/types";
import { formatDateTime, formatMs, formatTime } from "../../formatters";
import { Badge } from "../../ui/badge";
import { CompactMetrics } from "../../ui/compact-metrics";
import { AppliedTransactions, DispatchDocuments, DispatchMarkers } from "./dispatch-details";
import { TransactionBadges } from "./transaction-badges";

interface DispatchInspectorContextValue {
  state: {
    record: TransactionRecord;
  };
  actions: {
    restore: () => void;
  };
  meta: {
    markers: TransactionRecord["markers"];
  };
}

const DispatchInspectorContext = createContext<DispatchInspectorContextValue | null>(null);
function useDispatchInspector(): DispatchInspectorContextValue {
  const context = use(DispatchInspectorContext);
  if (!context) {
    throw new Error(
      "Dispatch inspector components must be rendered inside DispatchInspector.Root.",
    );
  }
  return context;
}

function DispatchInspectorRoot({
  instance,
  record,
  className,
  children,
}: {
  instance: RegisteredProseMirrorInstance;
  record: TransactionRecord;
  className?: string;
  children: ReactNode;
}): ReactElement {
  const markers = record.markers;
  const view = instance.view;
  const restore = useCallback(
    () => restoreDocument(view, record.docAfter, record.selectionAfter),
    [view, record],
  );
  const value = useMemo<DispatchInspectorContextValue>(
    () => ({
      state: { record },
      actions: { restore },
      meta: { markers },
    }),
    [record, restore, markers],
  );

  return (
    <DispatchInspectorContext value={value}>
      <section
        aria-label={`Dispatch ${record.id} inspector`}
        className={["pm-dispatch-inspector", className].filter(Boolean).join(" ")}
      >
        {children}
      </section>
    </DispatchInspectorContext>
  );
}

function DispatchInspectorHeader(): ReactElement {
  const {
    state: { record },
    actions: { restore },
  } = useDispatchInspector();

  return (
    <header className="pm-dispatch-header">
      <div className="pm-dispatch-identity">
        <span className="pm-eyebrow">Selected dispatch</span>
        <strong>#{record.id}</strong>
        <time
          className="pm-row-detail pm-history-timestamp"
          dateTime={new Date(record.timestamp).toISOString()}
          title={formatDateTime(record.timestamp)}
        >
          {formatTime(record.timestamp)}
        </time>
      </div>
      <div className="pm-dispatch-badges">
        <TransactionBadges record={record} />
      </div>
      <span className="pm-spacer" />
      <button className="pm-button" onClick={restore} type="button">
        Restore
      </button>
    </header>
  );
}

function DispatchInspectorMetrics(): ReactElement {
  const {
    state: { record },
    meta: { markers },
  } = useDispatchInspector();

  return (
    <CompactMetrics
      label={`Dispatch ${record.id} timings`}
      metrics={[
        { label: "Full dispatch", value: formatMs(record.totalDuration) },
        { label: "State apply", value: formatMs(record.applyDuration) },
        { label: "View update", value: formatMs(record.viewUpdateDuration) },
        { label: "Steps", value: String(record.stepCount) },
        {
          label: "Applied transactions",
          value: String(record.appliedTransactionCount ?? "?"),
        },
        { label: "Markers", value: String(markers.length) },
      ]}
    />
  );
}

function DetailsWorkspace({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="pm-dispatch-workspace" data-layout="details">
      {children}
    </div>
  );
}

function SplitWorkspace({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="pm-dispatch-workspace" data-layout="split">
      {children}
    </div>
  );
}

function PluginPane({ children }: { children: ReactNode }): ReactElement {
  return (
    <section aria-label="Dispatch cost" className="pm-dispatch-plugin-pane">
      {children}
    </section>
  );
}

function TransactionDetails(): ReactElement {
  const {
    state: { record },
    meta: { markers },
  } = useDispatchInspector();

  return (
    <aside aria-label="Transaction details" className="pm-dispatch-detail-pane">
      <DispatchMarkers markers={markers} />
      <div className="pm-workspace-heading">
        <span className="pm-section-title">Transactions</span>
        <Badge>{record.appliedTransactionCount ?? record.transactions.length}</Badge>
        <span className="pm-spacer" />
        <span className="pm-row-detail">root + appended</span>
      </div>
      {record.error ? <div className="pm-warning">{record.error}</div> : null}
      <AppliedTransactions record={record} />
      <DispatchDocuments record={record} />
    </aside>
  );
}

export const DispatchInspector = {
  Root: DispatchInspectorRoot,
  Header: DispatchInspectorHeader,
  Metrics: DispatchInspectorMetrics,
  DetailsWorkspace,
  SplitWorkspace,
  PluginPane,
  TransactionDetails,
};
