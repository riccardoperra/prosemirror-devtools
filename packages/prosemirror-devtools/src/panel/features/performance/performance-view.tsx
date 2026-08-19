import type { ReactElement } from "react";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { useSelectedTransaction } from "../../hooks/use-selected-transaction";
import { PluginPerformanceTable } from "./cumulative/plugin-performance-table";
import { PerformanceDispatchInspector } from "./performance-dispatch-inspector";
import { buildInitializationTimelineEntry, DispatchTimeline } from "./overview/dispatch-timeline";

export function PerformanceView({
  instance,
  detailThresholdMs,
  frameBudgetMs,
}: {
  instance: RegisteredProseMirrorInstance;
  detailThresholdMs: number | undefined;
  frameBudgetMs: number;
}): ReactElement {
  const records = instance.transactions;
  const { record: selected, selectedId, select } = useSelectedTransaction(records);
  const initialization = buildInitializationTimelineEntry(instance);

  if (records.length === 0 && !initialization) {
    return <div className="pm-empty">Dispatch a transaction to render performance bars.</div>;
  }

  return (
    <div className="pm-scroll pm-performance-view">
      <DispatchTimeline
        detailThresholdMs={detailThresholdMs}
        dispatchCount={instance.dispatchCount}
        frameBudgetMs={frameBudgetMs}
        initialization={initialization}
        records={records}
        selectedId={selectedId}
        onSelect={select}
      />
      {selected ? <PerformanceDispatchInspector instance={instance} record={selected} /> : null}
      <PluginPerformanceTable summaries={instance.pluginTimings} />
      <div className="pm-performance-note">
        <strong>Full sync</strong> merges the time covered by one plugin&apos;s observed hooks in
        the selected dispatch, so its nested spans count once. Hook chips and plugin rows are
        inclusive and may overlap; do not add them together. Plugin <code>view.update</code> runs
        inside <code>EditorView.updateState</code> and is included. Synchronous layout forced during
        these calls is included; later paint, compositing, and asynchronous framework commits are
        not.
      </div>
    </div>
  );
}
