import { createMemo, createSignal, Show, type JSX } from "solid-js";

import { panelStyles } from "../../../styles";
import { ViewSwitch } from "../../../ui/view-switch";

import type { TransactionRecord } from "../../../../core/types";
import { groupPluginTimings } from "../../../../performance/group-plugin-timings";
import { Badge } from "../../../ui/badge";
import { PluginTimingTimeline } from "../timeline/plugin-timing-timeline";
import { getPluginRankingVisibility, type DispatchCostView } from "./model";
import { PluginCostRanking } from "./plugin-cost-ranking";
import { DispatchCostSummary } from "./summary";
import { EmptyState } from "../../../ui/empty-state";

interface DispatchCoverageWarningProps {
  record: TransactionRecord;
}

function DispatchCoverageWarning(props: DispatchCoverageWarningProps): JSX.Element {
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

  return (
    <Show when={message()}>{(value) => <div class={panelStyles.pmWarning}>{value()}</div>}</Show>
  );
}

interface DispatchCostViewSwitchProps {
  value: DispatchCostView;
  onChange: (view: DispatchCostView) => void;
}

function DispatchCostViewSwitch(props: DispatchCostViewSwitchProps): JSX.Element {
  return (
    <ViewSwitch
      label="Dispatch cost view"
      onChange={props.onChange}
      options={[
        { value: "ranking", label: "Ranking" },
        { value: "timeline", label: "Timeline" },
      ]}
      value={props.value}
    />
  );
}

export interface DispatchCostBreakdownProps {
  record: TransactionRecord;
}

export function DispatchCostBreakdown(props: DispatchCostBreakdownProps): JSX.Element {
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
      <div class={panelStyles.pmWorkspaceHeading}>
        <span class={panelStyles.pmSectionTitle}>Dispatch cost</span>
        <Badge>{groups().length} plugins</Badge>
        <span class={panelStyles.pmSpacer} />
        <DispatchCostViewSwitch onChange={selectView} value={view()} />
      </div>
      <DispatchCoverageWarning record={props.record} />
      <DispatchCostSummary record={props.record} />
      <Show when={view() === "ranking"} fallback={<PluginTimingTimeline record={props.record} />}>
        <Show
          when={groups().length > 0}
          fallback={<EmptyState>No instrumented plugin hooks in this dispatch.</EmptyState>}
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
