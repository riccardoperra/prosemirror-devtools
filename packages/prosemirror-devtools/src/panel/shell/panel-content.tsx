import { lazy, Suspense } from "react";
import type { ReactElement } from "react";

import type { RegisteredProseMirrorInstance } from "../../core/types";
import { HistoryView } from "../features/history/history-view";
import { PluginsView } from "../features/plugins/plugins-view";
import { SchemaView } from "../features/schema/schema-view";
import { SnapshotsView } from "../features/snapshots/snapshots-view";
import { StateView } from "../features/state/state-view";
import type { ProseMirrorDevtoolsTab } from "../panel.types";
import { usePanelMeta, usePanelNavigation, usePanelStore } from "../panel-provider";
import { useActiveInstance } from "../store/selectors";
import { EmptyState } from "../ui/empty-state";

const PerformanceView = lazy(async () => {
  const module = await import("../features/performance/performance-view");
  return { default: module.PerformanceView };
});

function ActivePanelView({
  tab,
  instance,
  onClearHistory,
  performanceDetailThresholdMs,
  performanceFrameBudgetMs,
}: {
  tab: ProseMirrorDevtoolsTab;
  instance: RegisteredProseMirrorInstance;
  onClearHistory: () => void;
  performanceDetailThresholdMs: number | undefined;
  performanceFrameBudgetMs: number;
}): ReactElement {
  switch (tab) {
    case "state":
      return <StateView key={instance.id} instance={instance} />;
    case "history":
      return <HistoryView key={instance.id} instance={instance} onClear={onClearHistory} />;
    case "performance":
      return (
        <Suspense fallback={<div className="pm-empty">Loading performance tools…</div>}>
          <PerformanceView
            key={instance.id}
            instance={instance}
            detailThresholdMs={performanceDetailThresholdMs}
            frameBudgetMs={performanceFrameBudgetMs}
          />
        </Suspense>
      );
    case "plugins":
      return <PluginsView key={instance.id} instance={instance} />;
    case "schema":
      return <SchemaView key={instance.id} instance={instance} />;
    case "snapshots":
      return <SnapshotsView key={instance.id} instance={instance} />;
  }
}

export function PanelContent({
  performanceDetailThresholdMs,
  performanceFrameBudgetMs,
}: {
  performanceDetailThresholdMs: number | undefined;
  performanceFrameBudgetMs: number;
}): ReactElement {
  const store = usePanelStore();
  const activeInstance = useActiveInstance();
  const { activeTab } = usePanelNavigation();
  const { panelId, tabPanelId } = usePanelMeta();

  return (
    <main
      aria-labelledby={`${panelId}-tab-${activeTab}`}
      className="pm-body"
      id={tabPanelId}
      role="tabpanel"
      tabIndex={0}
    >
      {activeInstance ? (
        <ActivePanelView
          instance={activeInstance}
          onClearHistory={() => store.clearTransactions(activeInstance.id)}
          performanceDetailThresholdMs={performanceDetailThresholdMs}
          performanceFrameBudgetMs={performanceFrameBudgetMs}
          tab={activeTab}
        />
      ) : (
        <EmptyState />
      )}
    </main>
  );
}
