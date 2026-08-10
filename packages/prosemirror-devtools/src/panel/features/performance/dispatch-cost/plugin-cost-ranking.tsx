import { useId } from "react";
import type { ReactElement } from "react";

import type { PluginTimingGroup } from "../../../../performance/group-plugin-timings";
import { FAST_PLUGIN_THRESHOLD_MS } from "./model";
import { PluginCostChart } from "./plugin-cost-chart";
import { PluginTimingDetails } from "./plugin-timing-details";

export function PluginCostRanking({
  groups,
  visibleGroups,
  hiddenFastPluginCount,
  showAllFastPlugins,
  onToggleFastPlugins,
  dispatchDuration,
}: {
  groups: readonly PluginTimingGroup[];
  visibleGroups: readonly PluginTimingGroup[];
  hiddenFastPluginCount: number;
  showAllFastPlugins: boolean;
  onToggleFastPlugins: () => void;
  dispatchDuration: number;
}): ReactElement {
  const chartId = useId();

  return (
    <>
      <div id={chartId}>
        <PluginCostChart groups={visibleGroups} />
      </div>
      {hiddenFastPluginCount > 0 ? (
        <div className="pm-fast-plugin-disclosure">
          <button
            aria-controls={chartId}
            aria-expanded={showAllFastPlugins}
            onClick={onToggleFastPlugins}
            type="button"
          >
            <span aria-hidden="true">{showAllFastPlugins ? "−" : "+"}</span>
            {showAllFastPlugins
              ? `Hide ${hiddenFastPluginCount} plugins under ${FAST_PLUGIN_THRESHOLD_MS} ms`
              : `${hiddenFastPluginCount} plugins < ${FAST_PLUGIN_THRESHOLD_MS} ms`}
          </button>
        </div>
      ) : null}
      <PluginTimingDetails groups={groups} dispatchDuration={dispatchDuration} />
    </>
  );
}
