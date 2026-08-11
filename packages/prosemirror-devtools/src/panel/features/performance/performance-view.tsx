import { useMemo } from "react";
import type { ReactElement } from "react";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { formatMs } from "../../formatters";
import { useSelectedTransaction } from "../../hooks/use-selected-transaction";
import { CompactMetrics } from "../../ui/compact-metrics";
import { PluginPerformanceTable } from "./cumulative/plugin-performance-table";
import { PerformanceDispatchInspector } from "./performance-dispatch-inspector";
import { DispatchTimeline } from "./overview/dispatch-timeline";
import { buildPerformanceSummary } from "./overview/metrics";

export function PerformanceView({
  instance,
}: {
  instance: RegisteredProseMirrorInstance;
}): ReactElement {
  const records = instance.transactions;
  const { record: selected, selectedId, select } = useSelectedTransaction(records);
  const summary = useMemo(
    () => buildPerformanceSummary(records, instance.pluginTimings),
    [records, instance.pluginTimings],
  );

  if (records.length === 0) {
    return <div className="pm-empty">Dispatch a transaction to render performance bars.</div>;
  }

  return (
    <div className="pm-scroll pm-performance-view">
      <CompactMetrics
        label="Performance summary"
        metrics={[
          {
            label: "Dispatches",
            value: String(instance.dispatchCount),
            detail: `${records.length} retained`,
          },
          { label: "Average", value: formatMs(summary.average), detail: "dispatch total" },
          { label: "p95", value: formatMs(summary.percentile95) },
          { label: "Maximum", value: formatMs(summary.maximum) },
          {
            label: "Slowest hook",
            value: summary.slowest ? formatMs(summary.slowest.max) : "—",
            detail: summary.slowest
              ? `${summary.slowest.pluginLabel} · ${summary.slowest.hook}`
              : "No plugin samples",
          },
        ]}
      />
      <DispatchTimeline
        key={instance.id}
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
