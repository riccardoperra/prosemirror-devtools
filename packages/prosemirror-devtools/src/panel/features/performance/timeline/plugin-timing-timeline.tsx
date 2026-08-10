import { useMemo } from "react";
import type { ReactElement } from "react";

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

export function PluginTimingTimeline({ record }: { record: TransactionRecord }): ReactElement {
  const model = useMemo(() => buildPluginTimelineModel(record), [record]);

  return (
    <section aria-label="Ordered synchronous plugin timeline" className="pm-plugin-timeline">
      <div className="pm-plugin-timeline-heading">
        <span className="pm-plugin-timeline-copy">
          <strong>Ordered execution timeline</strong>
          <span>Top to bottom: start order · left to right: elapsed dispatch time</span>
        </span>
        <Badge>{model.pluginCallCount} calls</Badge>
      </div>
      <div aria-label="Timeline color legend" className="pm-plugin-timeline-legend">
        {legendItems.map(([family, label]) => (
          <span key={family}>
            <i data-family={family} />
            {label}
          </span>
        ))}
        <span>
          <i data-kind="minimum" />
          {"<0.01 ms shown at 2 px"}
        </span>
        <span className="pm-timeline-scroll-cue">Scroll time →</span>
      </div>
      <div className="pm-timeline-shell">
        <PluginTimelineLaneRail lanes={model.lanes} />
        <div
          aria-label="Scrollable dispatch time axis"
          className="pm-timeline-scroll"
          role="region"
          tabIndex={0}
        >
          <PluginTimelineChart lanes={model.lanes} totalDuration={record.totalDuration} />
        </div>
      </div>
    </section>
  );
}
