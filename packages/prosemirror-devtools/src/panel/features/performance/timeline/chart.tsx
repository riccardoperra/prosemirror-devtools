import { rect } from "@tanstack/charts/rect";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Chart } from "@tanstack/react-charts";
import { scaleBand, scaleLinear } from "d3-scale";
import { useMemo } from "react";
import type { ReactElement } from "react";

import { formatMs } from "../../../formatters";
import { formatTimelineOffset } from "../plugin-timing-formatters";
import type { PluginTimelineColor, PluginTimelineLane } from "./model";
import { timelineLaneDetail } from "./model";

export const PLUGIN_TIMELINE_ROW_HEIGHT = 32;

const chartMargin = { top: 10, right: 18, bottom: 34, left: 12 } as const;
const minimumTimelineWidth = 960;
const minimumIntervalPixels = 2;
const timelineColors: Record<PluginTimelineColor, string> = {
  dispatch: "var(--pm-border-strong)",
  apply: "var(--pm-accent)",
  viewUpdate: "var(--pm-green)",
  customDispatch: "var(--pm-blue)",
  state: "var(--pm-accent)",
  transaction: "var(--pm-blue)",
  view: "var(--pm-green)",
  props: "var(--pm-yellow)",
};

export function pluginTimelineChartHeight(laneCount: number): number {
  return laneCount * PLUGIN_TIMELINE_ROW_HEIGHT + chartMargin.top + chartMargin.bottom;
}

export function pluginTimelineLanePosition(index: number, laneCount: number): number {
  const plotHeight = laneCount * PLUGIN_TIMELINE_ROW_HEIGHT;
  const paddingInner = 0.22;
  const paddingOuter = 0.08;
  const step = plotHeight / Math.max(1, laneCount - paddingInner + paddingOuter * 2);
  const bandWidth = step * (1 - paddingInner);
  return chartMargin.top + paddingOuter * step + bandWidth / 2 + index * step;
}

function axisTime(value: number): string {
  return value === 0 ? "0 ms" : formatMs(value);
}

function tooltipTitle(lane: PluginTimelineLane): string {
  return lane.kind === "plugin" ? `Call ${lane.sequence} · ${lane.label}` : lane.label;
}

function visibleInterval(
  lane: PluginTimelineLane,
  domainEnd: number,
  plotWidth: number,
): readonly [number, number] {
  const minimumDuration = (domainEnd * minimumIntervalPixels) / Math.max(1, plotWidth);
  const start = Math.min(domainEnd, Math.max(0, lane.startOffset));
  const end = Math.min(domainEnd, Math.max(start, lane.endOffset));

  if (end - start >= minimumDuration) return [start, end];
  if (start + minimumDuration <= domainEnd) return [start, start + minimumDuration];
  return [Math.max(0, domainEnd - minimumDuration), domainEnd];
}

export function PluginTimelineChart({
  lanes,
  totalDuration,
}: {
  lanes: readonly PluginTimelineLane[];
  totalDuration: number;
}): ReactElement {
  const height = pluginTimelineChartHeight(lanes.length);
  const definition = useMemo(() => {
    const domainEnd = Math.max(0.001, totalDuration, ...lanes.map((lane) => lane.endOffset));
    const colorDomain = Object.keys(timelineColors) as PluginTimelineColor[];
    const sceneDefinition = defineChart(({ width }) => {
      const plotWidth = width - chartMargin.left - chartMargin.right;
      const intervalMark = rect(lanes, {
        id: "dispatch-intervals",
        x1: (lane) => visibleInterval(lane, domainEnd, plotWidth)[0],
        x2: (lane) => visibleInterval(lane, domainEnd, plotWidth)[1],
        y: "laneKey",
        color: "colorKey",
        key: "id",
        inset: 0,
        radius: 1,
        stroke: "var(--pm-panel)",
        strokeWidth: 0.5,
      });

      return {
        marks: [intervalMark] as const,
        x: {
          scale: scaleLinear().domain([0, domainEnd]),
          grid: true,
          axis: {
            line: true,
            ticks: {
              count: 9,
              size: 3,
              padding: 5,
              format: (value: number) => axisTime(Number(value)),
            },
            tickLabels: { fontSize: 9, thin: { minGap: 18, priority: "ends" as const } },
          },
        },
        y: {
          scale: scaleBand<string>()
            .domain(lanes.map((lane) => lane.laneKey))
            .paddingInner(0.22)
            .paddingOuter(0.08),
          grid: false,
          axis: false,
        },
        color: {
          domain: colorDomain,
          range: colorDomain.map((color) => timelineColors[color]),
        },
        margin: chartMargin,
      };
    });

    return defineChart(sceneDefinition, {
      animate: false,
      keyboard: true,
      tooltip: {
        use: tooltip,
        portal,
        anchor: "pointer",
        placement: ["top", "right", "left", "bottom"],
        content(points) {
          const lane = points[0]?.datum;
          if (!lane) return { rows: [] };
          return {
            title: tooltipTitle(lane),
            color: timelineColors[lane.colorKey],
            rows: [
              { label: "Kind", value: timelineLaneDetail(lane) },
              { label: "Starts at", value: `+${formatTimelineOffset(lane.startOffset)}` },
              { label: "Duration", value: formatMs(lane.duration) },
            ],
          };
        },
      },
    });
  }, [lanes, totalDuration]);

  return (
    <div
      className="pm-timeline-chart-surface"
      style={{ blockSize: `${height}px`, minInlineSize: `${minimumTimelineWidth}px` }}
    >
      <Chart
        ariaDescription="A shared elapsed-time axis. Overview spans appear first; plugin hook calls follow in strictly increasing measured start order. Intervals shorter than two display pixels use a two-pixel minimum rectangle while retaining their exact measured duration. Overlap means nested synchronous instrumentation, not parallel execution."
        ariaLabel="Ordered synchronous dispatch timeline"
        definition={definition}
        height={height}
        initialWidth={minimumTimelineWidth}
      />
    </div>
  );
}
