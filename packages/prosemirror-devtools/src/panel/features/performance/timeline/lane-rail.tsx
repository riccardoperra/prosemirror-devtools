import type { ReactElement } from "react";

import { formatMs } from "../../../formatters";
import { formatTimelineOffset } from "../plugin-timing-formatters";
import { pluginTimelineChartHeight, pluginTimelineLanePosition } from "./chart";
import type { PluginTimelineLane } from "./model";
import { timelineLaneDetail } from "./model";

function LaneText({ lane }: { lane: PluginTimelineLane }): ReactElement {
  if (lane.kind === "plugin") {
    return (
      <>
        <span className="pm-timeline-sequence">{lane.sequence}</span>
        <span className="pm-timeline-lane-copy" style={{ paddingInlineStart: lane.depth * 8 }}>
          <strong>{lane.label}</strong>
          <span>
            {lane.depth > 0 ? "↳ " : ""}
            {timelineLaneDetail(lane)} · {formatMs(lane.duration)}
          </span>
        </span>
      </>
    );
  }

  return (
    <span className="pm-timeline-lane-copy">
      <strong>{lane.label}</strong>
      <span>
        {timelineLaneDetail(lane)} · {formatMs(lane.duration)}
      </span>
    </span>
  );
}

export function PluginTimelineLaneRail({
  lanes,
}: {
  lanes: readonly PluginTimelineLane[];
}): ReactElement {
  const height = pluginTimelineChartHeight(lanes.length);

  return (
    <div
      aria-label="Dispatch timeline lanes"
      className="pm-timeline-lane-rail"
      role="list"
      style={{ blockSize: `${height}px` }}
    >
      {lanes.map((lane, index) => (
        <div
          aria-label={
            lane.kind === "plugin"
              ? `Call ${lane.sequence}: ${lane.label}, ${timelineLaneDetail(lane)}, starts at ${formatTimelineOffset(lane.startOffset)}, duration ${formatMs(lane.duration)}`
              : `${lane.label}, starts at ${formatTimelineOffset(lane.startOffset)}, duration ${formatMs(lane.duration)}`
          }
          className="pm-timeline-lane-label"
          data-depth={lane.kind === "plugin" ? lane.depth : undefined}
          data-kind={lane.kind}
          data-lane-key={lane.laneKey}
          data-sequence={lane.kind === "plugin" ? lane.sequence : undefined}
          data-start-offset={lane.startOffset}
          key={lane.id}
          role="listitem"
          style={{ top: `${pluginTimelineLanePosition(index, lanes.length)}px` }}
          title={lane.kind === "plugin" ? lane.pluginKey : lane.label}
        >
          <LaneText lane={lane} />
        </div>
      ))}
    </div>
  );
}
