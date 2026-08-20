import { barX } from "@tanstack/charts/bar";
import { defineChart } from "@tanstack/charts/scene";
import { text as textMark } from "@tanstack/charts/text";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Chart } from "@tanstack/solid-charts";
import { scaleBand, scaleLinear } from "d3-scale";
import { createMemo, type JSX } from "solid-js";

import type { PluginTimingGroup } from "../../../../performance/group-plugin-timings";

type PluginBarDatum = {
  key: string;
  pluginKey: string;
  pluginLabel: string;
  duration: number;
  callCount: number;
  hookCount: number;
  fill: string;
};

export function PluginCostChart(props: { groups: readonly PluginTimingGroup[] }): JSX.Element {
  const definition = createMemo(() => {
    const maximum = Math.max(...props.groups.map((group) => group.duration), 0.001);
    const labels = new Map(props.groups.map((group) => [group.pluginKey, group.pluginLabel]));
    const rows: PluginBarDatum[] = props.groups.map((group, index) => ({
      key: group.pluginKey,
      pluginKey: group.pluginKey,
      pluginLabel: group.pluginLabel,
      duration: group.duration,
      callCount: group.callCount,
      hookCount: group.hooks.length,
      fill: index === 0 ? "var(--pm-yellow)" : index === 1 ? "var(--pm-accent)" : "var(--pm-green)",
    }));
    const mark = barX(rows, {
      x: "duration",
      y: "pluginKey",
      key: "key",
      fill: (datum) => datum.fill,
      inset: 2,
      maxThickness: 21,
      radius: 2,
    });
    const labelsMark = textMark(rows, {
      x: "duration",
      y: "pluginKey",
      text: (datum) => `${datum.duration < 0.01 ? "<0.01" : datum.duration.toFixed(2)} ms`,
      key: (datum) => `${datum.key}:label`,
      fill: "var(--pm-text)",
      fontSize: 9,
      fontWeight: 700,
      anchor: "start",
      dx: 5,
    });
    return defineChart({
      marks: [mark, labelsMark] as const,
      x: { scale: scaleLinear().domain([0, maximum * 1.24]), axis: false },
      y: {
        scale: scaleBand<string>()
          .domain(rows.map((row) => row.pluginKey))
          .paddingInner(0.08)
          .paddingOuter(0.04),
        axis: {
          line: false,
          ticks: {
            size: 0,
            padding: 6,
            format: (value) => labels.get(String(value)) ?? String(value),
          },
          tickLabels: { fontSize: 10, fontWeight: 650, thin: false },
        },
      },
      animate: false,
      keyboard: true,
      tooltip: {
        use: tooltip,
        portal,
        anchor: "pointer",
        placement: ["top", "right", "left", "bottom"],
        content(points) {
          const datum = points[0]?.datum;
          return datum
            ? {
                title: datum.pluginLabel,
                color: datum.fill,
                rows: [
                  { label: "Full sync", value: `${datum.duration.toFixed(2)} ms` },
                  { label: "Hooks", value: String(datum.hookCount) },
                  { label: "Calls", value: String(datum.callCount) },
                ],
              }
            : { rows: [] };
        },
      },
    });
  });

  return (
    <div class="pm-tanstack-chart pm-plugin-cost-chart">
      <Chart
        ariaDescription="Plugins sorted from the largest full synchronous cost to the smallest."
        ariaLabel="Plugin cost ranking"
        definition={definition()}
        height={Math.max(112, props.groups.length * 28 + 24)}
        initialWidth={520}
      />
    </div>
  );
}
