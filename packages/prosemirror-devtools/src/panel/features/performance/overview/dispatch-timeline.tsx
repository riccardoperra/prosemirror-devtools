import { barY } from "@tanstack/charts/bar";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Chart } from "@tanstack/react-charts";
import { scaleBand, scaleLinear } from "d3-scale";
import { useMemo } from "react";
import type { ReactElement } from "react";

import type { TransactionRecord } from "../../../../core/types";

type DispatchBarDatum = {
  key: string;
  dispatchKey: string;
  dispatchId: number;
  phase: "State apply" | "View update" | "Custom code" | "Other sync work";
  duration: number;
  totalDuration: number;
  y1: number;
  y2: number;
  fill: string;
};

const phaseColors: Record<DispatchBarDatum["phase"], string> = {
  "State apply": "var(--pm-accent)",
  "View update": "var(--pm-green)",
  "Custom code": "var(--pm-blue)",
  "Other sync work": "var(--pm-border-strong)",
};

const legend = [
  ["State apply", "var(--pm-accent)"],
  ["View update", "var(--pm-green)"],
  ["Custom code", "var(--pm-blue)"],
  ["Other sync work", "var(--pm-border-strong)"],
] as const;

function dispatchRows(
  records: readonly TransactionRecord[],
  selectedId: number,
): DispatchBarDatum[] {
  const rows: DispatchBarDatum[] = [];
  for (const record of records) {
    const apply = Math.max(0, record.applyDuration ?? 0);
    const view = Math.max(0, record.viewUpdateDuration ?? 0);
    const custom = Math.max(0, (record.customDispatchDuration ?? 0) - apply - view);
    const other = Math.max(0, record.totalDuration - apply - view - custom);
    const phases: Array<[DispatchBarDatum["phase"], number]> = [
      ["State apply", apply],
      ["View update", view],
      ["Custom code", custom],
      ["Other sync work", other],
    ];
    let cursor = 0;
    for (const [phase, duration] of phases) {
      if (duration <= 0) continue;
      const y1 = cursor;
      cursor += duration;
      rows.push({
        key: `${record.id}:${phase}`,
        dispatchKey: String(record.id),
        dispatchId: record.id,
        phase,
        duration,
        totalDuration: record.totalDuration,
        y1,
        y2: cursor,
        fill:
          record.id === selectedId
            ? phaseColors[phase]
            : `color-mix(in srgb, ${phaseColors[phase]} 72%, transparent)`,
      });
    }
  }
  return rows;
}

export function DispatchTimeline({
  records,
  selectedId,
  onSelect,
}: {
  records: readonly TransactionRecord[];
  selectedId: number;
  onSelect: (id: number) => void;
}): ReactElement {
  const visible = useMemo(() => records.slice(-60), [records]);
  const definition = useMemo(() => {
    const rows = dispatchRows(visible, selectedId);
    const domain = visible.map((record) => String(record.id));
    const maximum = Math.max(...visible.map((record) => record.totalDuration), 0.1);
    const mark = barY(rows, {
      x: "dispatchKey",
      y1: "y1",
      y2: "y2",
      key: "key",
      fill: (datum) => datum.fill,
      inset: 0,
      maxThickness: 22,
      radius: 0,
    });
    return defineChart({
      marks: [mark] as const,
      x: {
        scale: scaleBand<string>().domain(domain).paddingInner(0.08).paddingOuter(0.03),
        axis: false,
      },
      y: { scale: scaleLinear().domain([0, maximum]), axis: false },
      animate: false,
      keyboard: true,
      tooltip: {
        use: tooltip,
        portal,
        anchor: "pointer",
        placement: ["right", "left", "top", "bottom"],
        content(points) {
          const datum = points[0]?.datum;
          return datum
            ? {
                title: `Dispatch #${datum.dispatchId}`,
                color: datum.fill,
                rows: [
                  { label: "Segment", value: datum.phase, color: datum.fill },
                  { label: "Segment duration", value: `${datum.duration.toFixed(2)} ms` },
                  { label: "Full dispatch", value: `${datum.totalDuration.toFixed(2)} ms` },
                ],
              }
            : { rows: [] };
        },
      },
    });
  }, [selectedId, visible]);
  const width = Math.max(52, visible.length * 26);

  return (
    <section className="pm-chart-wrap">
      <div className="pm-chart-header">
        <span className="pm-section-title">Dispatch timeline</span>
        <span className="pm-spacer" />
        <div className="pm-chart-legend">
          {legend.map(([label, color]) => (
            <span key={label}>
              <i className="pm-legend-dot" style={{ background: color }} />
              {label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>
      <div className="pm-tanstack-chart pm-dispatch-chart" data-selected-id={selectedId}>
        <div className="pm-dispatch-chart-plot" style={{ inlineSize: `${width}px` }}>
          <Chart
            ariaDescription="Stacked state apply, view update, custom code, and other synchronous duration for the latest dispatches."
            ariaLabel="Dispatch duration bar chart"
            definition={definition}
            height={148}
            initialWidth={width}
            onSelect={(point) => {
              if (point) onSelect(point.datum.dispatchId);
            }}
          />
        </div>
        <span aria-live="polite" className="pm-chart-selection">
          Selected dispatch #{selectedId}
        </span>
      </div>
    </section>
  );
}
