import { createContext, useContext, For, Show, type Accessor, type JSX } from "solid-js";

import { cx, panelStyles } from "../../styles";

import { restoreDocument } from "../../../core/snapshots";
import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../core/types";
import { formatDateTime, formatMs, formatTime } from "../../formatters";
import { Badge } from "../../ui/badge";
import { CompactMetrics } from "../../ui/compact-metrics";
import { AppliedTransactions, DispatchDocuments, DispatchMarkers } from "./dispatch-details";
import { TransactionBadges } from "./transaction-badges";
import { useOptionalPanelInspection } from "../../panel-provider";

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

interface DispatchInspectorRootProps {
  instance: RegisteredProseMirrorInstance;
  record: TransactionRecord;
  className?: string | undefined;
  children: JSX.Element;
}

function DispatchInspectorRoot(props: DispatchInspectorRootProps): JSX.Element {
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
        class={cx(panelStyles.pmDispatchInspector, props.className)}
      >
        {props.children}
      </section>
    </DispatchInspectorContext.Provider>
  );
}

function DispatchInspectorHeader(): JSX.Element {
  const inspector = useDispatchInspector();
  const inspection = useOptionalPanelInspection();
  const plugins = () =>
    [
      ...new Map(
        inspector.record().timings.map(({ pluginKey, pluginLabel }) => [pluginKey, pluginLabel]),
      ).entries(),
    ].slice(0, 20);

  return (
    <>
      <header class={panelStyles.pmDispatchHeader}>
        <div class={panelStyles.pmDispatchIdentity}>
          <span class={panelStyles.pmEyebrow}>Selected dispatch</span>
          <strong>#{inspector.record().id}</strong>
          <time
            class={cx(panelStyles.pmRowDetail, panelStyles.pmHistoryTimestamp)}
            dateTime={new Date(inspector.record().timestamp).toISOString()}
            title={formatDateTime(inspector.record().timestamp)}
          >
            {formatTime(inspector.record().timestamp)}
          </time>
        </div>
        <div class={panelStyles.pmDispatchBadges}>
          <TransactionBadges record={inspector.record()} />
        </div>
        <span class={panelStyles.pmSpacer} />
        <button class={panelStyles.pmButton} onClick={inspector.restore} type="button">
          Restore
        </button>
      </header>
      <Show when={inspection}>
        <details class={panelStyles.pmDispatchRelated}>
          <summary>Related evidence</summary>
          <nav class={panelStyles.pmDispatchRelatedLinks} aria-label="Related dispatch evidence">
            <For
              each={[
                { panel: "history", title: "Transactions" },
                { panel: "performance", title: "Performance" },
                { panel: "state", title: "Document after dispatch" },
                { panel: "decorations", title: "Rendering evidence" },
              ]}
            >
              {({ panel, title }) => (
                <button
                  class={panelStyles.pmButton}
                  type="button"
                  onClick={() =>
                    inspection?.selectTransaction({
                      instanceId: inspector.record().instanceId,
                      id: inspector.record().id,
                      panel,
                    })
                  }
                >
                  {title}
                </button>
              )}
            </For>
            <For each={plugins()}>
              {([key, label]) => (
                <button
                  class={panelStyles.pmButton}
                  type="button"
                  onClick={() => inspection?.selectPlugin(key)}
                >
                  Plugin {label}
                </button>
              )}
            </For>
          </nav>
        </details>
      </Show>
    </>
  );
}

function DispatchInspectorMetrics(): JSX.Element {
  const inspector = useDispatchInspector();

  return (
    <CompactMetrics
      label={`Dispatch ${inspector.record().id} timings`}
      metrics={[
        { label: "Synchronous dispatch", value: formatMs(inspector.record().totalDuration) },
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

interface DetailsWorkspaceProps {
  children: JSX.Element;
}

function DetailsWorkspace(props: DetailsWorkspaceProps): JSX.Element {
  return (
    <div class={panelStyles.pmDispatchWorkspace} data-layout="details">
      {props.children}
    </div>
  );
}

interface SplitWorkspaceProps {
  children: JSX.Element;
}

function SplitWorkspace(props: SplitWorkspaceProps): JSX.Element {
  return (
    <div class={panelStyles.pmDispatchWorkspace} data-layout="split">
      {props.children}
    </div>
  );
}

interface PluginPaneProps {
  children: JSX.Element;
}

function PluginPane(props: PluginPaneProps): JSX.Element {
  return (
    <section aria-label="Dispatch cost" class={panelStyles.pmDispatchPluginPane}>
      {props.children}
    </section>
  );
}

function TransactionDetails(): JSX.Element {
  const inspector = useDispatchInspector();

  return (
    <aside aria-label="Transaction details" class={panelStyles.pmDispatchDetailPane}>
      <DispatchMarkers markers={inspector.markers()} />
      <div class={panelStyles.pmWorkspaceHeading}>
        <span class={panelStyles.pmSectionTitle}>Transactions</span>
        <Badge>
          {inspector.record().appliedTransactionCount ?? inspector.record().transactions.length}
        </Badge>
        <span class={panelStyles.pmSpacer} />
        <span class={panelStyles.pmRowDetail}>root + appended</span>
      </div>
      <Show when={inspector.record().error}>
        {(error) => <div class={panelStyles.pmWarning}>{error()}</div>}
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
