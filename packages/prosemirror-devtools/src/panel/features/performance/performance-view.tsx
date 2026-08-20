import { createMemo, Show, type JSX } from "solid-js";

import { cx, panelStyles } from "../../styles";

import type { RegisteredProseMirrorInstance } from "../../../core/types";
import { useSelectedTransaction } from "../../hooks/use-selected-transaction";
import { PluginPerformanceTable } from "./cumulative/plugin-performance-table";
import { PerformanceDispatchInspector } from "./performance-dispatch-inspector";
import { buildInitializationTimelineEntry, DispatchTimeline } from "./overview/dispatch-timeline";

export interface PerformanceViewProps {
  instance: RegisteredProseMirrorInstance;
  detailThresholdMs: number | undefined;
  frameBudgetMs: number;
}

export function PerformanceView(props: PerformanceViewProps): JSX.Element {
  const records = createMemo(() => props.instance.transactions);
  const { record: selected, selectedId, select } = useSelectedTransaction(records);
  const initialization = createMemo(() => buildInitializationTimelineEntry(props.instance));
  const hasPerformanceData = createMemo(() => records().length > 0 || initialization() !== null);

  return (
    <Show
      when={hasPerformanceData()}
      fallback={
        <div class={panelStyles.pmEmpty}>Dispatch a transaction to render performance bars.</div>
      }
    >
      <div class={cx(panelStyles.pmScroll, panelStyles.pmPerformanceView)}>
        <DispatchTimeline
          detailThresholdMs={props.detailThresholdMs}
          dispatchCount={props.instance.dispatchCount}
          frameBudgetMs={props.frameBudgetMs}
          initialization={initialization()}
          onSelect={select}
          records={records()}
          selectedId={selectedId()}
        />
        <Show when={selected()}>
          {(record) => <PerformanceDispatchInspector instance={props.instance} record={record()} />}
        </Show>
        <PluginPerformanceTable summaries={props.instance.pluginTimings} />
        <div class={panelStyles.pmPerformanceNote}>
          <strong>Full sync</strong> merges the time covered by one plugin&apos;s observed hooks in
          the selected dispatch, so its nested spans count once. Hook chips and plugin rows are
          inclusive and may overlap; do not add them together. Plugin <code>view.update</code> runs
          inside <code>EditorView.updateState</code> and is included. Synchronous layout forced
          during these calls is included; later paint, compositing, and asynchronous framework
          commits are not.
        </div>
      </div>
    </Show>
  );
}
