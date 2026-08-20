import { barY } from "@tanstack/charts/bar";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Chart } from "@tanstack/solid-charts";
import { scaleBand, scaleLinear } from "d3-scale";
import type { ScaleLinear } from "d3-scale";
import { createMemo, createSignal, For, Show, type JSX } from "solid-js";

import type { RegisteredProseMirrorInstance, TransactionRecord } from "../../../../core/types";
import { buildDispatchPhaseBreakdown } from "../../../../performance/phase-timings";
import { formatDateTime, formatMs } from "../../../formatters";
import { DEFAULT_PERFORMANCE_FRAME_BUDGET_MS } from "../../../panel.constants";
import { buildPerformanceSummary } from "./metrics";

type DispatchBarDatum = {
  key: string;
  timelineKey: string;
  kind: "initialization" | "dispatch";
  dispatchId: number | null;
  phase:
    | "Initialization"
    | "State apply"
    | "View update"
    | "Custom code"
    | "Other sync work"
    | "Below timer resolution";
  duration: number;
  totalDuration: number;
  belowResolution: boolean;
  y1: number;
  y2: number;
  fill: string;
  initialization: InitializationTimelineEntry | null;
};

const phaseColors: Record<DispatchBarDatum["phase"], string> = {
  Initialization: "var(--pm-yellow)",
  "State apply": "var(--pm-accent)",
  "View update": "var(--pm-green)",
  "Custom code": "var(--pm-blue)",
  "Other sync work": "var(--pm-border-strong)",
  "Below timer resolution": "var(--pm-muted)",
};

const legend = [
  ["Initialization", "var(--pm-yellow)"],
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
const minimumPhaseSegmentHeight = 3;
const adaptiveDetailSampleRatio = 0.2;
const adaptiveDetailMultiplier = 4;
const adaptiveDetailBudgetFraction = 0.25;
const dispatchWindowSize = 60;
const dispatchSlotWidth = 26;
const minimumVisibleDurationMs = 0.01;
const initializationKey = "initialization";

export interface InitializationTimelineEntry {
  instanceId: string;
  instanceLabel: string;
  registeredAt: number;
  duration: number;
  stateInitDuration: number;
  viewCreateDuration: number;
  pluginCount: number;
  hookCount: number;
}

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

export function buildInitializationTimelineEntry(
  instance: Pick<RegisteredProseMirrorInstance, "id" | "label" | "registeredAt" | "pluginTimings">,
): InitializationTimelineEntry | null {
  let stateInitDuration = 0;
  let viewCreateDuration = 0;
  let hookCount = 0;
  const pluginKeys = new Set<string>();

  for (const timing of instance.pluginTimings) {
    if (timing.hook === "state.init") stateInitDuration += timing.total;
    else if (timing.hook === "view.create") viewCreateDuration += timing.total;
    else continue;
    hookCount += timing.count;
    pluginKeys.add(timing.pluginKey);
  }

  if (hookCount === 0) return null;
  return {
    instanceId: instance.id,
    instanceLabel: instance.label,
    registeredAt: instance.registeredAt,
    duration: stateInitDuration + viewCreateDuration,
    stateInitDuration,
    viewCreateDuration,
    pluginCount: pluginKeys.size,
    hookCount,
  };
}

function timelineDomain(
  records: readonly TransactionRecord[],
  hasInitialization: boolean,
): string[] {
  const emptySlotCount = Math.max(0, dispatchWindowSize - records.length);
  return [
    ...(hasInitialization ? [initializationKey] : []),
    ...records.map((record) => String(record.id)),
    ...Array.from({ length: emptySlotCount }, (_, index) => `empty:${index}`),
  ];
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
    const observed = new Set(record.phaseTimings.map(({ phase }) => phase));
    let phases: Array<{
      phase: DispatchBarDatum["phase"];
      duration: number;
      observed: boolean;
    }> = [
      {
        phase: "State apply",
        duration: breakdown.applyDuration,
        observed: observed.has("apply"),
      },
      {
        phase: "View update",
        duration: breakdown.viewUpdateDuration,
        observed: observed.has("viewUpdate"),
      },
      {
        phase: "Custom code",
        duration: breakdown.customCodeDuration,
        // `customDispatch` covers apply and view too. Only show the exclusive custom-code segment
        // when interval subtraction found measurable time outside those phases.
        observed: breakdown.customCodeDuration > 0,
      },
      {
        phase: "Other sync work",
        duration: breakdown.otherDuration,
        observed: breakdown.otherDuration > 0,
      },
    ];
    phases = phases.filter(({ duration, observed: wasObserved }) => duration > 0 || wasObserved);
    if (phases.length === 0) {
      phases = [{ phase: "Below timer resolution", duration: 0, observed: true }];
    }

    // Build one unified stack in display-pixel space. Every observed phase reserves a small strip,
    // even when its two clock reads were equal; remaining height is distributed by exact duration.
    // Converting the pixel boundaries back through the scale preserves the chart API and leaves all
    // recorded millisecond values untouched for metrics and tooltips.
    const phaseTotal = phases.reduce((total, { duration }) => total + duration, 0);
    const paintedTotal = Math.max(
      durationScale(record.totalDuration),
      minimumPositiveBarHeight,
      phases.length * minimumPhaseSegmentHeight,
    );
    const distributableHeight = Math.max(
      0,
      paintedTotal - phases.length * minimumPhaseSegmentHeight,
    );
    let paintedCursor = 0;
    for (const { phase, duration } of phases) {
      const y1 = durationScale.invert(paintedCursor);
      paintedCursor +=
        phaseTotal > 0
          ? minimumPhaseSegmentHeight + (duration / phaseTotal) * distributableHeight
          : paintedTotal / phases.length;
      rows.push({
        key: `${record.id}:${phase}`,
        timelineKey: String(record.id),
        kind: "dispatch",
        dispatchId: record.id,
        phase,
        duration,
        totalDuration: record.totalDuration,
        belowResolution: duration === 0,
        y1,
        y2: durationScale.invert(paintedCursor),
        fill:
          record.id === selectedId
            ? phaseColors[phase]
            : `color-mix(in srgb, ${phaseColors[phase]} 72%, transparent)`,
        initialization: null,
      });
    }
  }
  return rows;
}

function initializationRow(initialization: InitializationTimelineEntry): DispatchBarDatum {
  return {
    key: initializationKey,
    timelineKey: initializationKey,
    kind: "initialization",
    dispatchId: null,
    phase: "Initialization",
    duration: initialization.duration,
    totalDuration: initialization.duration,
    belowResolution: false,
    y1: 0,
    y2: Math.max(initialization.duration, minimumVisibleDurationMs),
    fill: phaseColors.Initialization,
    initialization,
  };
}

export function DispatchTimeline(props: {
  records: readonly TransactionRecord[];
  initialization: InitializationTimelineEntry | null;
  dispatchCount: number;
  selectedId: number;
  onSelect: (id: number) => void;
  detailThresholdMs: number | undefined;
  frameBudgetMs: number;
}): JSX.Element {
  const [windowStartId, setWindowStartId] = createSignal<number | null>(null);
  const model = createMemo(() => {
    const summary = buildPerformanceSummary(props.records);
    const window = resolveDispatchWindow(props.records, windowStartId(), props.selectedId);
    const adaptiveDetail = resolveAdaptiveDetailThreshold(
      [
        ...(props.initialization
          ? [Math.max(props.initialization.duration, minimumVisibleDurationMs)]
          : []),
        ...window.visible.map((record) => record.totalDuration),
      ],
      props.frameBudgetMs,
    );
    const fixedDetailThresholdMs =
      props.detailThresholdMs !== undefined &&
      Number.isFinite(props.detailThresholdMs) &&
      props.detailThresholdMs >= 0
        ? props.detailThresholdMs
        : null;
    const requestedDetailThresholdMs = fixedDetailThresholdMs ?? adaptiveDetail.thresholdMs;
    const measuredMaximum = Math.max(
      props.initialization ? Math.max(props.initialization.duration, minimumVisibleDurationMs) : 0,
      ...window.visible.map((record) => record.totalDuration),
      0,
    );
    const scale = resolveDispatchTimelineScale(
      measuredMaximum,
      props.frameBudgetMs,
      requestedDetailThresholdMs,
    );
    const rows = [
      ...(props.initialization ? [initializationRow(props.initialization)] : []),
      ...dispatchRows(window.visible, props.selectedId, scale.maximum, scale.detailThresholdMs),
    ];
    const domain = timelineDomain(window.visible, props.initialization !== null);
    const mark = barY(rows, {
      x: "timelineKey",
      y1: "y1",
      y2: "y2",
      key: "key",
      fill: (datum) => datum.fill,
      inset: 0,
      radius: 0,
    });
    const definition = defineChart({
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
        scale: createDispatchDurationScale(scale.maximum, scale.detailThresholdMs),
        grid: false,
        axis: {
          line: true,
          ticks: {
            values: durationAxisTicks(scale.maximum, scale.detailThresholdMs),
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
          if (!datum) return { rows: [] };
          if (datum.kind === "initialization" && datum.initialization) {
            const metadata = datum.initialization;
            return {
              title: "Editor initialization",
              color: datum.fill,
              rows: [
                {
                  label: "Instance",
                  value: metadata.instanceLabel + " (" + metadata.instanceId + ")",
                  color: datum.fill,
                },
                { label: "Measured hooks", value: formatMs(metadata.duration) },
                { label: "state.init", value: formatMs(metadata.stateInitDuration) },
                { label: "view.create", value: formatMs(metadata.viewCreateDuration) },
                { label: "Hook calls", value: String(metadata.hookCount) },
                { label: "Plugins", value: String(metadata.pluginCount) },
                {
                  label: "Registered",
                  value: formatDateTime(metadata.registeredAt),
                },
              ],
            };
          }
          return {
            title: "Dispatch #" + datum.dispatchId,
            color: datum.fill,
            rows: [
              { label: "Segment", value: datum.phase, color: datum.fill },
              {
                label: "Segment duration",
                value: datum.belowResolution
                  ? "Below timer resolution"
                  : datum.duration.toFixed(2) + " ms",
              },
              {
                label: "Full dispatch",
                value:
                  datum.totalDuration === 0
                    ? "Below timer resolution"
                    : datum.totalDuration.toFixed(2) + " ms",
              },
            ],
          };
        },
      },
    });
    const slotCount = dispatchWindowSize + (props.initialization ? 1 : 0);
    const initialWidth = slotCount * dispatchSlotWidth + chartMargin.left + chartMargin.right;
    const budgetLabel =
      "Frame budget: " +
      formatBudgetMs(scale.frameBudgetMs) +
      " ms (" +
      scale.frameRate +
      " FPS target)";
    const scaleDescription =
      scale.detailThresholdMs > 0
        ? "Durations from zero to " +
          formatBudgetMs(scale.detailThresholdMs) +
          " milliseconds are expanded for visibility while tooltips retain exact values. " +
          (fixedDetailThresholdMs === null
            ? "The threshold is four times the " +
              formatBudgetMs(adaptiveDetail.shortAverageMs) +
              " millisecond average of the fastest visible 20 percent."
            : "The threshold is configured explicitly.")
        : "The Y axis uses a linear scale.";

    return {
      adaptiveDetail,
      budgetLabel,
      definition,
      fixedDetailThresholdMs,
      hasNext: window.selectedIndex >= 0 && window.selectedIndex < props.records.length - 1,
      hasPrevious: window.selectedIndex > 0,
      initialWidth,
      scale,
      scaleDescription,
      selectionLabel: Math.max(0, window.selectedIndex + 1) + " / " + props.records.length,
      slotCount,
      summary,
      window,
    };
  });

  const selectAtIndex = (index: number): void => {
    const target = props.records[index];
    if (!target) return;

    const current = model().window;
    let nextStartIndex = current.startIndex;
    if (index < current.startIndex) {
      nextStartIndex = index;
    } else if (index >= current.endIndex) {
      nextStartIndex = Math.max(0, index - dispatchWindowSize + 1);
    }

    setWindowStartId(
      index === props.records.length - 1 ? null : (props.records[nextStartIndex]?.id ?? null),
    );
    props.onSelect(target.id);
  };

  return (
    <section class="pm-chart-wrap">
      <div
        aria-label="Performance overview and dispatch navigation"
        class="pm-chart-header pm-performance-toolbar"
      >
        <div aria-label="Performance summary" class="pm-chart-summary" role="list">
          <span class="pm-chart-summary-metric" role="listitem">
            <span>Dispatches</span>
            <strong>{props.dispatchCount}</strong>
            <Show when={props.records.length < props.dispatchCount}>
              <small>{props.records.length} retained</small>
            </Show>
          </span>
          <span class="pm-chart-summary-metric" role="listitem">
            <span>Average</span>
            <strong>{formatMs(model().summary.average)}</strong>
          </span>
          <span class="pm-chart-summary-metric" role="listitem">
            <span>p95</span>
            <strong>{formatMs(model().summary.percentile95)}</strong>
          </span>
          <span class="pm-chart-summary-metric" role="listitem">
            <span>Maximum</span>
            <strong>{formatMs(model().summary.maximum)}</strong>
          </span>
        </div>
        <div aria-label="Dispatch selection" class="pm-dispatch-selection" role="group">
          <button
            aria-label="Select previous dispatch"
            disabled={!model().hasPrevious}
            onClick={() => selectAtIndex(model().window.selectedIndex - 1)}
            title="Previous dispatch"
            type="button"
          >
            <span aria-hidden="true">←</span>
          </button>
          <output
            aria-label={
              "Selected dispatch " +
              Math.max(0, model().window.selectedIndex + 1) +
              " of " +
              props.records.length
            }
            aria-live="polite"
          >
            {model().selectionLabel}
          </output>
          <button
            aria-label="Select next dispatch"
            disabled={!model().hasNext}
            onClick={() => selectAtIndex(model().window.selectedIndex + 1)}
            title="Next dispatch"
            type="button"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <span class="pm-spacer" />
        <div aria-label="Dispatch phases" class="pm-chart-legend">
          <For each={legend}>
            {([label, color]) => (
              <span>
                <i class="pm-legend-dot" style={{ background: color }} />
                {label.toLowerCase()}
              </span>
            )}
          </For>
        </div>
      </div>
      <div
        class="pm-tanstack-chart pm-dispatch-chart"
        data-detail-threshold-mode={model().fixedDetailThresholdMs === null ? "auto" : "fixed"}
        data-detail-threshold-ms={model().scale.detailThresholdMs}
        data-frame-budget-ms={model().scale.frameBudgetMs}
        data-has-initialization={props.initialization !== null}
        data-scale-maximum-ms={model().scale.maximum}
        data-selected-id={props.selectedId}
        data-slot-count={model().slotCount}
        data-window-end-id={model().window.visible.at(-1)?.id}
        data-window-start-id={model().window.visible.at(0)?.id}
      >
        <Show when={model().scale.detailThresholdMs > 0}>
          <span
            aria-hidden="true"
            class="pm-duration-detail-zone"
            style={{
              "inset-block-end": 2 + chartMargin.bottom + "px",
              "inset-block-start": 4 + model().scale.detailZoneTop + "px",
              "inset-inline-end": 8 + chartMargin.right + "px",
              "inset-inline-start": 8 + chartMargin.left + "px",
            }}
          />
        </Show>
        <span
          aria-hidden="true"
          class="pm-frame-budget-reference"
          style={{
            "inset-block-start": 4 + model().scale.budgetLineTop + "px",
            "inset-inline-end": 8 + chartMargin.right + "px",
            "inset-inline-start": 8 + chartMargin.left + "px",
          }}
        >
          <span class="pm-frame-budget-label">{model().budgetLabel}</span>
        </span>
        <div class="pm-dispatch-chart-plot">
          <Chart
            ariaDescription={
              (props.initialization
                ? "The first yellow bar summarizes measured state initialization and view creation plugin hooks. "
                : "") +
              "Stacked state apply, view update, custom code, and other synchronous duration for recent dispatches. A minimal muted bar means the dispatch completed below the browser timer resolution. The dashed line marks the " +
              model().budgetLabel +
              ". " +
              model().scaleDescription +
              " This is a dispatch-time budget, not measured browser frame rate."
            }
            ariaLabel="Dispatch duration bar chart"
            definition={model().definition}
            height={chartHeight}
            initialWidth={model().initialWidth}
            onSelect={(point) => {
              if (!point || point.datum.kind !== "dispatch" || point.datum.dispatchId === null) {
                return;
              }
              selectAtIndex(
                props.records.findIndex((record) => record.id === point.datum.dispatchId),
              );
            }}
          />
        </div>
      </div>
    </section>
  );
}
