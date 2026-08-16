import { barY } from "@tanstack/charts/bar";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Chart } from "@tanstack/react-charts";
import { scaleBand, scaleLinear } from "d3-scale";
import type { ScaleLinear } from "d3-scale";
import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import type { TransactionRecord } from "../../../../core/types";
import { buildDispatchPhaseBreakdown } from "../../../../performance/phase-timings";
import { formatMs } from "../../../formatters";
import { DEFAULT_PERFORMANCE_FRAME_BUDGET_MS } from "../../../panel.constants";
import { buildPerformanceSummary } from "./metrics";

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

const chartHeight = 174;
const chartMargin = { top: 26, right: 12, bottom: 12, left: 34 } as const;
const plotHeight = chartHeight - chartMargin.top - chartMargin.bottom;
const domainHeadroom = 1.15;
const detailZoneHeight = 42;
const minimumPositiveBarHeight = 6;
const adaptiveDetailSampleRatio = 0.2;
const adaptiveDetailMultiplier = 4;
const adaptiveDetailBudgetFraction = 0.25;
const dispatchWindowSize = 60;
const dispatchSlotWidth = 26;

export interface DispatchTimelineScale {
  frameBudgetMs: number;
  frameRate: number;
  detailThresholdMs: number;
  maximum: number;
  budgetLineTop: number;
  detailZoneTop: number;
}

export interface AdaptiveDispatchDetailThreshold {
  thresholdMs: number;
  shortAverageMs: number;
  sampleSize: number;
}

/** Matches Angular DevTools' duration-to-frame-rate calculation, with a configurable cap. */
export function calculateFrameRate(timeSpent: number, maximumFrameRate = 60): number {
  const cap =
    Number.isFinite(maximumFrameRate) && maximumFrameRate > 0
      ? Math.max(1, Math.round(maximumFrameRate))
      : 60;
  if (timeSpent <= 0) return cap;
  return Math.min(cap, Math.round(1000 / timeSpent));
}

export function resolveDispatchTimelineScale(
  measuredMaximum: number,
  requestedFrameBudgetMs: number,
  requestedDetailThresholdMs: number,
): DispatchTimelineScale {
  const frameBudgetMs =
    Number.isFinite(requestedFrameBudgetMs) && requestedFrameBudgetMs > 0
      ? requestedFrameBudgetMs
      : DEFAULT_PERFORMANCE_FRAME_BUDGET_MS;
  const safeMeasuredMaximum =
    Number.isFinite(measuredMaximum) && measuredMaximum > 0 ? measuredMaximum : 0;
  const detailThresholdMs =
    Number.isFinite(requestedDetailThresholdMs) && requestedDetailThresholdMs >= 0
      ? requestedDetailThresholdMs
      : 0;
  const maximum =
    Math.max(safeMeasuredMaximum, frameBudgetMs, detailThresholdMs * 2, 0.1) * domainHeadroom;
  const targetFrameRate = Math.max(1, Math.round(1000 / frameBudgetMs));
  const durationScale = createDispatchDurationScale(maximum, detailThresholdMs).range([
    0,
    plotHeight,
  ]);
  const lineTop = (duration: number): number =>
    chartMargin.top + plotHeight - durationScale(duration);

  return {
    frameBudgetMs,
    frameRate: calculateFrameRate(frameBudgetMs, targetFrameRate),
    detailThresholdMs,
    maximum,
    budgetLineTop: lineTop(frameBudgetMs),
    detailZoneTop: lineTop(detailThresholdMs),
  };
}

/** Uses the fastest 20% of positive visible dispatches to size the expanded detail zone. */
export function resolveAdaptiveDetailThreshold(
  durations: readonly number[],
  requestedFrameBudgetMs: number,
): AdaptiveDispatchDetailThreshold {
  const positive = durations
    .filter((duration) => Number.isFinite(duration) && duration > 0)
    .sort((left, right) => left - right);
  if (positive.length === 0) {
    return { thresholdMs: 0, shortAverageMs: 0, sampleSize: 0 };
  }

  const sampleSize = Math.max(1, Math.ceil(positive.length * adaptiveDetailSampleRatio));
  const shortAverageMs =
    positive.slice(0, sampleSize).reduce((total, duration) => total + duration, 0) / sampleSize;
  const frameBudgetMs =
    Number.isFinite(requestedFrameBudgetMs) && requestedFrameBudgetMs > 0
      ? requestedFrameBudgetMs
      : DEFAULT_PERFORMANCE_FRAME_BUDGET_MS;

  return {
    thresholdMs: Math.min(
      shortAverageMs * adaptiveDetailMultiplier,
      frameBudgetMs * adaptiveDetailBudgetFraction,
    ),
    shortAverageMs,
    sampleSize,
  };
}

/**
 * Keeps semantic values in milliseconds while reserving an expanded detail zone for
 * sub-threshold durations. Any positive value receives at least six painted pixels.
 */
export function createDispatchDurationScale(
  maximum: number,
  detailThresholdMs: number,
): ScaleLinear<number, number> {
  const safeMaximum = Number.isFinite(maximum) && maximum > 0 ? maximum : 1;
  const safeThreshold =
    Number.isFinite(detailThresholdMs) && detailThresholdMs > 0
      ? Math.min(detailThresholdMs, safeMaximum / 2)
      : 0;
  const domain = safeThreshold ? [0, Number.EPSILON, safeThreshold, safeMaximum] : [0, safeMaximum];
  const scale = scaleLinear<number, number>().domain(domain);
  const applyRange = scale.range.bind(scale);

  scale.range = ((values?: Iterable<number>) => {
    if (values === undefined) return applyRange();
    const [start = 0, end = 1] = Array.from(values);
    if (!safeThreshold) return applyRange([start, end]);

    const span = end - start;
    const direction = Math.sign(span) || 1;
    const available = Math.abs(span);
    const expandedHeight = Math.min(detailZoneHeight, available * 0.4);
    const positiveHeight = Math.min(minimumPositiveBarHeight, expandedHeight * 0.25);
    return applyRange([
      start,
      start + direction * positiveHeight,
      start + direction * expandedHeight,
      end,
    ]);
  }) as ScaleLinear<number, number>["range"];
  scale.copy = () => createDispatchDurationScale(safeMaximum, safeThreshold);

  return scale;
}

export function resolveDispatchWindow<T extends Pick<TransactionRecord, "id">>(
  records: readonly T[],
  windowStartId: number | null,
  selectedId: number,
): {
  visible: readonly T[];
  startIndex: number;
  endIndex: number;
  selectedIndex: number;
} {
  const maximumStartIndex = Math.max(0, records.length - dispatchWindowSize);
  const selectedIndex = records.findIndex((record) => record.id === selectedId);
  const requestedStartIndex =
    windowStartId === null
      ? maximumStartIndex
      : records.findIndex((record) => record.id === windowStartId);
  let startIndex =
    requestedStartIndex < 0
      ? Math.min(Math.max(0, selectedIndex), maximumStartIndex)
      : Math.min(requestedStartIndex, maximumStartIndex);

  if (selectedIndex >= 0 && selectedIndex < startIndex) {
    startIndex = selectedIndex;
  } else if (selectedIndex >= startIndex + dispatchWindowSize) {
    startIndex = selectedIndex - dispatchWindowSize + 1;
  }

  const endIndex = Math.min(records.length, startIndex + dispatchWindowSize);
  return {
    visible: records.slice(startIndex, endIndex),
    startIndex,
    endIndex,
    selectedIndex,
  };
}

function formatBudgetMs(duration: number): string {
  if (duration >= 10) return duration.toFixed(1);
  if (duration >= 0.01) return duration.toFixed(2);
  if (duration >= 0.001) return duration.toFixed(3);
  return duration.toPrecision(2);
}

function formatAxisDuration(value: number): string {
  if (value === 0) return "0";
  if (value < 0.1) return value.toFixed(2);
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

function durationAxisTicks(maximum: number, detailThresholdMs: number): number[] {
  const ticks = scaleLinear().domain([0, maximum]).ticks(3);
  return [...new Set([0, ...(detailThresholdMs > 0 ? [detailThresholdMs] : []), ...ticks])]
    .filter((value) => value <= maximum)
    .sort((left, right) => left - right);
}

function dispatchRows(
  records: readonly TransactionRecord[],
  selectedId: number,
  maximum: number,
  detailThresholdMs: number,
): DispatchBarDatum[] {
  const rows: DispatchBarDatum[] = [];
  const durationScale = createDispatchDurationScale(maximum, detailThresholdMs).range([
    0,
    plotHeight,
  ]);
  for (const record of records) {
    const breakdown = buildDispatchPhaseBreakdown(record);
    const phases: Array<[DispatchBarDatum["phase"], number]> = [
      ["State apply", breakdown.applyDuration],
      ["View update", breakdown.viewUpdateDuration],
      ["Custom code", breakdown.customCodeDuration],
      ["Other sync work", breakdown.otherDuration],
    ];
    const phaseTotal = phases.reduce((total, [, duration]) => total + duration, 0);
    const paintedTotal = durationScale(record.totalDuration);
    const paintedBoundary = (duration: number): number =>
      phaseTotal > 0 ? durationScale.invert((duration / phaseTotal) * paintedTotal) : 0;
    let cursor = 0;
    for (const [phase, duration] of phases) {
      if (duration <= 0) continue;
      const y1 = paintedBoundary(cursor);
      cursor += duration;
      rows.push({
        key: `${record.id}:${phase}`,
        dispatchKey: String(record.id),
        dispatchId: record.id,
        phase,
        duration,
        totalDuration: record.totalDuration,
        y1,
        y2: paintedBoundary(cursor),
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
  dispatchCount,
  selectedId,
  onSelect,
  detailThresholdMs,
  frameBudgetMs,
}: {
  records: readonly TransactionRecord[];
  dispatchCount: number;
  selectedId: number;
  onSelect: (id: number) => void;
  detailThresholdMs: number | undefined;
  frameBudgetMs: number;
}): ReactElement {
  const [windowStartId, setWindowStartId] = useState<number | null>(null);
  const summary = useMemo(() => buildPerformanceSummary(records), [records]);
  const { visible, startIndex, endIndex, selectedIndex } = useMemo(
    () => resolveDispatchWindow(records, windowStartId, selectedId),
    [records, selectedId, windowStartId],
  );
  const adaptiveDetail = useMemo(
    () =>
      resolveAdaptiveDetailThreshold(
        visible.map((record) => record.totalDuration),
        frameBudgetMs,
      ),
    [frameBudgetMs, visible],
  );
  const fixedDetailThresholdMs =
    detailThresholdMs !== undefined && Number.isFinite(detailThresholdMs) && detailThresholdMs >= 0
      ? detailThresholdMs
      : null;
  const requestedDetailThresholdMs = fixedDetailThresholdMs ?? adaptiveDetail.thresholdMs;
  const measuredMaximum = Math.max(...visible.map((record) => record.totalDuration), 0);
  const scale = useMemo(
    () => resolveDispatchTimelineScale(measuredMaximum, frameBudgetMs, requestedDetailThresholdMs),
    [frameBudgetMs, measuredMaximum, requestedDetailThresholdMs],
  );
  const {
    budgetLineTop,
    detailThresholdMs: resolvedDetailThresholdMs,
    detailZoneTop,
    frameBudgetMs: resolvedFrameBudgetMs,
    frameRate,
    maximum,
  } = scale;
  const definition = useMemo(() => {
    const rows = dispatchRows(visible, selectedId, maximum, resolvedDetailThresholdMs);
    const domain = visible.map((record) => String(record.id));
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
        axis: {
          line: true,
          ticks: false,
          tickLabels: false,
        },
      },
      y: {
        scale: createDispatchDurationScale(maximum, resolvedDetailThresholdMs),
        grid: false,
        axis: {
          line: true,
          ticks: {
            values: durationAxisTicks(maximum, resolvedDetailThresholdMs),
            size: 0,
            padding: 4,
            format: formatAxisDuration,
          },
          tickLabels: { fontSize: 8, thin: false },
          label: { text: "Time (ms)", offset: 30 },
        },
      },
      margin: chartMargin,
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
  }, [maximum, resolvedDetailThresholdMs, selectedId, visible]);
  const hasPrevious = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < records.length - 1;
  const selectionLabel = `${Math.max(0, selectedIndex + 1)} / ${records.length}`;

  const selectAtIndex = (index: number): void => {
    const target = records[index];
    if (!target) return;

    let nextStartIndex = startIndex;
    if (index < startIndex) {
      nextStartIndex = index;
    } else if (index >= endIndex) {
      nextStartIndex = Math.max(0, index - dispatchWindowSize + 1);
    }

    setWindowStartId(index === records.length - 1 ? null : (records[nextStartIndex]?.id ?? null));
    onSelect(target.id);
  };

  const width = Math.max(
    240,
    visible.length * dispatchSlotWidth + chartMargin.left + chartMargin.right,
  );
  const budgetLabel = `Frame budget: ${formatBudgetMs(resolvedFrameBudgetMs)} ms (${frameRate} FPS target)`;
  const scaleDescription =
    resolvedDetailThresholdMs > 0
      ? `Durations from zero to ${formatBudgetMs(resolvedDetailThresholdMs)} milliseconds are expanded for visibility while tooltips retain exact values. ${fixedDetailThresholdMs === null ? `The threshold is four times the ${formatBudgetMs(adaptiveDetail.shortAverageMs)} millisecond average of the fastest visible 20 percent.` : "The threshold is configured explicitly."}`
      : "The Y axis uses a linear scale.";

  return (
    <section className="pm-chart-wrap">
      <div
        aria-label="Performance overview and dispatch navigation"
        className="pm-chart-header pm-performance-toolbar"
      >
        <div aria-label="Performance summary" className="pm-chart-summary" role="list">
          <span className="pm-chart-summary-metric" role="listitem">
            <span>Dispatches</span>
            <strong>{dispatchCount}</strong>
            {records.length < dispatchCount ? <small>{records.length} retained</small> : null}
          </span>
          <span className="pm-chart-summary-metric" role="listitem">
            <span>Average</span>
            <strong>{formatMs(summary.average)}</strong>
          </span>
          <span className="pm-chart-summary-metric" role="listitem">
            <span>p95</span>
            <strong>{formatMs(summary.percentile95)}</strong>
          </span>
          <span className="pm-chart-summary-metric" role="listitem">
            <span>Maximum</span>
            <strong>{formatMs(summary.maximum)}</strong>
          </span>
        </div>
        <div aria-label="Dispatch selection" className="pm-dispatch-selection" role="group">
          <button
            aria-label="Select previous dispatch"
            disabled={!hasPrevious}
            onClick={() => selectAtIndex(selectedIndex - 1)}
            title="Previous dispatch"
            type="button"
          >
            <span aria-hidden="true">←</span>
          </button>
          <output
            aria-label={`Selected dispatch ${Math.max(0, selectedIndex + 1)} of ${records.length}`}
            aria-live="polite"
          >
            {selectionLabel}
          </output>
          <button
            aria-label="Select next dispatch"
            disabled={!hasNext}
            onClick={() => selectAtIndex(selectedIndex + 1)}
            title="Next dispatch"
            type="button"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <span className="pm-spacer" />
        <div aria-label="Dispatch phases" className="pm-chart-legend">
          {legend.map(([label, color]) => (
            <span key={label}>
              <i className="pm-legend-dot" style={{ background: color }} />
              {label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>
      <div
        className="pm-tanstack-chart pm-dispatch-chart"
        data-detail-threshold-mode={fixedDetailThresholdMs === null ? "auto" : "fixed"}
        data-detail-threshold-ms={resolvedDetailThresholdMs}
        data-frame-budget-ms={resolvedFrameBudgetMs}
        data-scale-maximum-ms={maximum}
        data-selected-id={selectedId}
        data-window-end-id={visible.at(-1)?.id}
        data-window-start-id={visible.at(0)?.id}
      >
        {resolvedDetailThresholdMs > 0 ? (
          <span
            aria-hidden="true"
            className="pm-duration-detail-zone"
            style={{
              insetBlockEnd: `${2 + chartMargin.bottom}px`,
              insetBlockStart: `${4 + detailZoneTop}px`,
              insetInlineEnd: `${8 + chartMargin.right}px`,
              insetInlineStart: `${8 + chartMargin.left}px`,
            }}
          />
        ) : null}
        <span
          aria-hidden="true"
          className="pm-frame-budget-reference"
          style={{
            insetBlockStart: `${4 + budgetLineTop}px`,
            insetInlineEnd: `${8 + chartMargin.right}px`,
            insetInlineStart: `${8 + chartMargin.left}px`,
          }}
        >
          <span className="pm-frame-budget-label">{budgetLabel}</span>
        </span>
        <div className="pm-dispatch-chart-plot" style={{ inlineSize: `${width}px` }}>
          <Chart
            ariaDescription={`Stacked state apply, view update, custom code, and other synchronous duration for recent dispatches. The dashed line marks the ${budgetLabel}. ${scaleDescription} This is a dispatch-time budget, not measured browser frame rate.`}
            ariaLabel="Dispatch duration bar chart"
            definition={definition}
            height={chartHeight}
            initialWidth={width}
            onSelect={(point) => {
              if (!point) return;
              selectAtIndex(records.findIndex((record) => record.id === point.datum.dispatchId));
            }}
          />
        </div>
      </div>
    </section>
  );
}
