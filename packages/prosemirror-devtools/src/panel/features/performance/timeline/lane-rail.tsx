import { createMemo, For, Show, type JSX } from "solid-js";

import { formatMs } from "../../../formatters";
import { formatTimelineOffset } from "../plugin-timing-formatters";
import { pluginTimelineChartHeight, pluginTimelineLanePosition } from "./chart";
import type { PluginTimelineLane } from "./model";
import { timelineLaneDetail } from "./model";

function LaneText(props: { lane: PluginTimelineLane }): JSX.Element {
  return (
    <Show
      when={props.lane.kind === "plugin" ? props.lane : undefined}
      fallback={
        <span class="pm-timeline-lane-copy">
          <strong>{props.lane.label}</strong>
          <span>
            {timelineLaneDetail(props.lane)} · {formatMs(props.lane.duration)}
          </span>
        </span>
      }
    >
      {(lane) => (
        <>
          <span class="pm-timeline-sequence">{lane().sequence}</span>
          <span
            class="pm-timeline-lane-copy"
            style={{ "padding-inline-start": `${lane().depth * 8}px` }}
          >
            <strong>{lane().label}</strong>
            <span>
              {lane().depth > 0 ? "↳ " : ""}
              {timelineLaneDetail(lane())} · {formatMs(lane().duration)}
            </span>
          </span>
        </>
      )}
    </Show>
  );
}

export function PluginTimelineLaneRail(props: {
  lanes: readonly PluginTimelineLane[];
}): JSX.Element {
  const height = createMemo(() => pluginTimelineChartHeight(props.lanes.length));

  return (
    <div
      aria-label="Dispatch timeline lanes"
      class="pm-timeline-lane-rail"
      role="list"
      style={{ "block-size": `${height()}px` }}
    >
      <For each={props.lanes}>
        {(lane, index) => (
          <div
            aria-label={
              lane.kind === "plugin"
                ? `Call ${lane.sequence}: ${lane.label}, ${timelineLaneDetail(lane)}, starts at ${formatTimelineOffset(lane.startOffset)}, duration ${formatMs(lane.duration)}`
                : `${lane.label}, starts at ${formatTimelineOffset(lane.startOffset)}, duration ${formatMs(lane.duration)}`
            }
            class="pm-timeline-lane-label"
            data-depth={lane.kind === "plugin" ? lane.depth : undefined}
            data-kind={lane.kind}
            data-lane-key={lane.laneKey}
            data-sequence={lane.kind === "plugin" ? lane.sequence : undefined}
            data-start-offset={lane.startOffset}
            role="listitem"
            style={{ top: `${pluginTimelineLanePosition(index(), props.lanes.length)}px` }}
            title={lane.kind === "plugin" ? lane.pluginKey : lane.label}
          >
            <LaneText lane={lane} />
          </div>
        )}
      </For>
    </div>
  );
}
