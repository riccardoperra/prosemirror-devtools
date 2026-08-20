import { createContext, useContext, Show, type Accessor, type JSX } from "solid-js";

import { restoreDocument } from "../../../core/snapshots";
import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../core/types";
import { formatDateTime, formatMs, formatTime } from "../../formatters";
import { Badge } from "../../ui/badge";
import { CompactMetrics } from "../../ui/compact-metrics";
import { AppliedTransactions, DispatchDocuments, DispatchMarkers } from "./dispatch-details";
import { TransactionBadges } from "./transaction-badges";

interface DispatchInspectorContextValue {
  record: Accessor<TransactionRecord>;
  markers: Accessor<TransactionRecord["markers"]>;
  restore: () => void;
}

const DispatchInspectorContext = createContext<DispatchInspectorContextValue>();

function useDispatchInspector(): DispatchInspectorContextValue {
  const context = useContext(DispatchInspectorContext);
  if (!context) {
    throw new Error(
      "Dispatch inspector components must be rendered inside DispatchInspector.Root.",
    );
  }
  return context;
}

function DispatchInspectorRoot(props: {
  instance: RegisteredProseMirrorInstance;
  record: TransactionRecord;
  className?: string;
  children: JSX.Element;
}): JSX.Element {
  const value: DispatchInspectorContextValue = {
    record: () => props.record,
    markers: () => props.record.markers,
    restore: () =>
      restoreDocument(props.instance.view, props.record.docAfter, props.record.selectionAfter),
  };

  return (
    <DispatchInspectorContext.Provider value={value}>
      <section
        aria-label={`Dispatch ${props.record.id} inspector`}
        class={["pm-dispatch-inspector", props.className].filter(Boolean).join(" ")}
      >
        {props.children}
      </section>
    </DispatchInspectorContext.Provider>
  );
}

function DispatchInspectorHeader(): JSX.Element {
  const inspector = useDispatchInspector();

  return (
    <header class="pm-dispatch-header">
      <div class="pm-dispatch-identity">
        <span class="pm-eyebrow">Selected dispatch</span>
        <strong>#{inspector.record().id}</strong>
        <time
          class="pm-row-detail pm-history-timestamp"
          dateTime={new Date(inspector.record().timestamp).toISOString()}
          title={formatDateTime(inspector.record().timestamp)}
        >
          {formatTime(inspector.record().timestamp)}
        </time>
      </div>
      <div class="pm-dispatch-badges">
        <TransactionBadges record={inspector.record()} />
      </div>
      <span class="pm-spacer" />
      <button class="pm-button" onClick={inspector.restore} type="button">
        Restore
      </button>
    </header>
  );
}

function DispatchInspectorMetrics(): JSX.Element {
  const inspector = useDispatchInspector();

  return (
    <CompactMetrics
      label={`Dispatch ${inspector.record().id} timings`}
      metrics={[
        { label: "Full dispatch", value: formatMs(inspector.record().totalDuration) },
        { label: "State apply", value: formatMs(inspector.record().applyDuration) },
        { label: "View update", value: formatMs(inspector.record().viewUpdateDuration) },
        { label: "Steps", value: String(inspector.record().stepCount) },
        {
          label: "Applied transactions",
          value: String(inspector.record().appliedTransactionCount ?? "?"),
        },
        { label: "Markers", value: String(inspector.markers().length) },
      ]}
    />
  );
}

function DetailsWorkspace(props: { children: JSX.Element }): JSX.Element {
  return (
    <div class="pm-dispatch-workspace" data-layout="details">
      {props.children}
    </div>
  );
}

function SplitWorkspace(props: { children: JSX.Element }): JSX.Element {
  return (
    <div class="pm-dispatch-workspace" data-layout="split">
      {props.children}
    </div>
  );
}

function PluginPane(props: { children: JSX.Element }): JSX.Element {
  return (
    <section aria-label="Dispatch cost" class="pm-dispatch-plugin-pane">
      {props.children}
    </section>
  );
}

function TransactionDetails(): JSX.Element {
  const inspector = useDispatchInspector();

  return (
    <aside aria-label="Transaction details" class="pm-dispatch-detail-pane">
      <DispatchMarkers markers={inspector.markers()} />
      <div class="pm-workspace-heading">
        <span class="pm-section-title">Transactions</span>
        <Badge>
          {inspector.record().appliedTransactionCount ?? inspector.record().transactions.length}
        </Badge>
        <span class="pm-spacer" />
        <span class="pm-row-detail">root + appended</span>
      </div>
      <Show when={inspector.record().error}>
        {(error) => <div class="pm-warning">{error()}</div>}
      </Show>
      <AppliedTransactions record={inspector.record()} />
      <DispatchDocuments record={inspector.record()} />
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
