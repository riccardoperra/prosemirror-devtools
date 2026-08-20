import { createMemo, createSignal, Show, type JSX } from "solid-js";

import type { TransactionRecord } from "../../../../core/types";
import { groupPluginTimings } from "../../../../performance/group-plugin-timings";
import { Badge } from "../../../ui/badge";
import { PluginTimingTimeline } from "../timeline/plugin-timing-timeline";
import { getPluginRankingVisibility, type DispatchCostView } from "./model";
import { PluginCostRanking } from "./plugin-cost-ranking";
import { DispatchCostSummary } from "./summary";

function DispatchCoverageWarning(props: { record: TransactionRecord }): JSX.Element {
  const message = createMemo(() => {
    if (
      props.record.customDispatchDuration == null ||
      (props.record.applicationStatus !== "unknown" &&
        props.record.applyDuration != null &&
        props.record.viewUpdateDuration != null)
    ) {
      return null;
    }

    return props.record.applicationStatus === "unknown"
      ? "The dispatched transaction could not be correlated with the final view state. Observed phases are timed, but application and appended-transaction counts remain unknown."
      : "This custom dispatcher did not expose both phases synchronously. Public state and view calls are split when observed; deferred or externally managed work remains unattributed.";
  });

  return <Show when={message()}>{(value) => <div class="pm-warning">{value()}</div>}</Show>;
}

function DispatchCostViewSwitch(props: {
  value: DispatchCostView;
  onChange: (view: DispatchCostView) => void;
}): JSX.Element {
  return (
    <div aria-label="Dispatch cost view" class="pm-view-switch" role="group">
      <button
        aria-pressed={props.value === "ranking"}
        onClick={() => props.onChange("ranking")}
        type="button"
      >
        Ranking
      </button>
      <button
        aria-pressed={props.value === "timeline"}
        onClick={() => props.onChange("timeline")}
        type="button"
      >
        Timeline
      </button>
    </div>
  );
}

export function DispatchCostBreakdown(props: { record: TransactionRecord }): JSX.Element {
  const groups = createMemo(() => groupPluginTimings(props.record.timings));
  const collapsedRanking = createMemo(() => getPluginRankingVisibility(groups(), false));
  const [view, selectView] = createSignal<DispatchCostView>("ranking");
  const [showAllFastPlugins, setShowAllFastPlugins] = createSignal(false);
  const visibleGroups = createMemo(() =>
    showAllFastPlugins() ? groups() : collapsedRanking().visibleGroups,
  );
  const hiddenFastPluginCount = createMemo(() => collapsedRanking().hiddenFastGroups.length);

  return (
    <>
      <div class="pm-workspace-heading">
        <span class="pm-section-title">Dispatch cost</span>
        <Badge>{groups().length} plugins</Badge>
        <span class="pm-spacer" />
        <DispatchCostViewSwitch onChange={selectView} value={view()} />
      </div>
      <DispatchCoverageWarning record={props.record} />
      <DispatchCostSummary record={props.record} />
      <Show when={view() === "ranking"} fallback={<PluginTimingTimeline record={props.record} />}>
        <Show
          when={groups().length > 0}
          fallback={
            <div class="pm-plugin-timing-empty">No instrumented plugin hooks in this dispatch.</div>
          }
        >
          <PluginCostRanking
            dispatchDuration={props.record.totalDuration}
            groups={groups()}
            hiddenFastPluginCount={hiddenFastPluginCount()}
            onToggleFastPlugins={() => setShowAllFastPlugins((current) => !current)}
            showAllFastPlugins={showAllFastPlugins()}
            visibleGroups={visibleGroups()}
          />
        </Show>
      </Show>
    </>
  );
}
