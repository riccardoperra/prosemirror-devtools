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
        <strong>Timeline</strong>
        <Badge>{model.pluginCallCount} calls</Badge>
      </div>
      <div aria-label="Timeline color legend" className="pm-plugin-timeline-legend">
        {legendItems.map(([family, label]) => (
          <span key={family}>
            <i data-family={family} />
            {label}
          </span>
        ))}
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
