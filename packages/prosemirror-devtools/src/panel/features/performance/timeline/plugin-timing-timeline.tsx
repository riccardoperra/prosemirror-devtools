import { createMemo, For, type JSX } from "solid-js";

import type { TransactionRecord } from "../../../../core/types";
import { Badge } from "../../../ui/badge";
import { PluginTimelineChart } from "./chart";
import { PluginTimelineLaneRail } from "./lane-rail";
import { buildPluginTimelineModel } from "./model";

const legendItems = [
  ["state", "State hooks"],
  ["transaction", "Transaction hooks"],
  ["view", "View hooks"],
  ["props", "Other props"],
] as const;

export function PluginTimingTimeline(props: { record: TransactionRecord }): JSX.Element {
  const model = createMemo(() => buildPluginTimelineModel(props.record));

  return (
    <section aria-label="Ordered synchronous plugin timeline" class="pm-plugin-timeline">
      <div class="pm-plugin-timeline-heading">
        <span class="pm-plugin-timeline-copy">
          <strong>Ordered execution timeline</strong>
          <span>Top to bottom: start order · left to right: elapsed dispatch time</span>
        </span>
        <Badge>{model().pluginCallCount} calls</Badge>
      </div>
      <div aria-label="Timeline color legend" class="pm-plugin-timeline-legend">
        <For each={legendItems}>
          {([family, label]) => (
            <span>
              <i data-family={family} />
              {label}
            </span>
          )}
        </For>
        <span>
          <i data-kind="minimum" />
          {"<0.01 ms shown at 2 px"}
        </span>
        <span class="pm-timeline-scroll-cue">Scroll time →</span>
      </div>
      <div class="pm-timeline-shell">
        <PluginTimelineLaneRail lanes={model().lanes} />
        <div
          aria-label="Scrollable dispatch time axis"
          class="pm-timeline-scroll"
          role="region"
          tabIndex={0}
        >
          <PluginTimelineChart lanes={model().lanes} totalDuration={props.record.totalDuration} />
        </div>
      </div>
    </section>
  );
}
