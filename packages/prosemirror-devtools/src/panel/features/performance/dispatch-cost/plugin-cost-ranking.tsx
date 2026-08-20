import { createUniqueId, Show, type JSX } from "solid-js";

import type { PluginTimingGroup } from "../../../../performance/group-plugin-timings";
import { FAST_PLUGIN_THRESHOLD_MS } from "./model";
import { PluginCostChart } from "./plugin-cost-chart";
import { PluginTimingDetails } from "./plugin-timing-details";

export function PluginCostRanking(props: {
  groups: readonly PluginTimingGroup[];
  visibleGroups: readonly PluginTimingGroup[];
  hiddenFastPluginCount: number;
  showAllFastPlugins: boolean;
  onToggleFastPlugins: () => void;
  dispatchDuration: number;
}): JSX.Element {
  const chartId = createUniqueId();

  return (
    <>
      <div id={chartId}>
        <PluginCostChart groups={props.visibleGroups} />
      </div>
      <Show when={props.hiddenFastPluginCount > 0}>
        <div class="pm-fast-plugin-disclosure">
          <button
            aria-controls={chartId}
            aria-expanded={props.showAllFastPlugins}
            onClick={props.onToggleFastPlugins}
            type="button"
          >
            <span aria-hidden="true">{props.showAllFastPlugins ? "−" : "+"}</span>
            {props.showAllFastPlugins
              ? `Hide ${props.hiddenFastPluginCount} plugins under ${FAST_PLUGIN_THRESHOLD_MS} ms`
              : `${props.hiddenFastPluginCount} plugins < ${FAST_PLUGIN_THRESHOLD_MS} ms`}
          </button>
        </div>
      </Show>
      <PluginTimingDetails dispatchDuration={props.dispatchDuration} groups={props.groups} />
    </>
  );
}
