import { barY } from "@tanstack/charts/bar";
import { defineChart } from "@tanstack/charts/scene";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import { Chart } from "@tanstack/react-charts";
import { scaleBand, scaleLinear } from "d3-scale";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { TransactionRecord } from "../../../../core/types";

type DispatchBarDatum = {
  key: string;
  dispatchKey: string;
  dispatchId: number;
  phase: "State apply" | "View update" | "dispatchTransaction()" | "Other work";
  duration: number;
  totalDuration: number;
  y1: number;
  y2: number;
  fill: string;
};

const phaseColors: Record<DispatchBarDatum["phase"], string> = {
  "State apply": "var(--pm-timeline-state)",
  "View update": "var(--pm-timeline-view)",
  "dispatchTransaction()": "var(--pm-timeline-handler)",
  "Other work": "var(--pm-timeline-dispatch)",
};

const legend = [
  ["State apply", "var(--pm-timeline-state)"],
  ["View update", "var(--pm-timeline-view)"],
  ["dispatchTransaction()", "var(--pm-timeline-handler)"],
  ["Other work", "var(--pm-timeline-dispatch)"],
] as const;

const DEFAULT_DISPATCH_WINDOW_SIZE = 60;
const DISPATCH_SLOT_WIDTH = 24;
const DISPATCH_CHART_INITIAL_WIDTH = 720;

export function resolveDispatchWindowSize(containerWidth: number): number {
  return Number.isFinite(containerWidth) && containerWidth > 0
    ? Math.max(1, Math.floor(containerWidth / DISPATCH_SLOT_WIDTH))
    : DEFAULT_DISPATCH_WINDOW_SIZE;
}

export function resolveDispatchWindow<T extends Pick<TransactionRecord, "id">>(
  records: readonly T[],
  windowStartId: number | null,
  selectedId: number,
  windowSize = DEFAULT_DISPATCH_WINDOW_SIZE,
): {
  visible: readonly T[];
  startIndex: number;
  endIndex: number;
  selectedIndex: number;
} {
  const resolvedWindowSize = Math.max(1, Math.floor(windowSize));
  const maximumStartIndex = Math.max(0, records.length - resolvedWindowSize);
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
  } else if (selectedIndex >= startIndex + resolvedWindowSize) {
    startIndex = selectedIndex - resolvedWindowSize + 1;
  }

  const endIndex = Math.min(records.length, startIndex + resolvedWindowSize);

  return {
    visible: records.slice(startIndex, endIndex),
    startIndex,
    endIndex,
    selectedIndex,
  };
}

function measuredContentWidth(element: HTMLElement): number {
  const ownerWindow = element.ownerDocument.defaultView;
  const bounds = element.getBoundingClientRect();
  const computed = ownerWindow?.getComputedStyle(element);
  const padding = computed
    ? Number.parseFloat(computed.paddingInlineStart) + Number.parseFloat(computed.paddingInlineEnd)
    : 0;
  return Math.max(0, bounds.width - (Number.isFinite(padding) ? padding : 0));
}

function useDispatchWindowSize(): {
  chartRef: React.RefObject<HTMLDivElement | null>;
  windowSize: number;
} {
  const chartRef = useRef<HTMLDivElement>(null);
  const [windowSize, setWindowSize] = useState(DEFAULT_DISPATCH_WINDOW_SIZE);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;

    const update = (width: number): void => {
      const next = resolveDispatchWindowSize(width);
      setWindowSize((current) => (current === next ? current : next));
    };

    update(measuredContentWidth(element));
    const ResizeObserverConstructor = element.ownerDocument.defaultView?.ResizeObserver;
    if (!ResizeObserverConstructor) return;

    const observer = new ResizeObserverConstructor((entries) => {
      const entry = entries[0];
      if (entry) update(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { chartRef, windowSize };
}

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
      ["dispatchTransaction()", custom],
      ["Other work", other],
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
  const { chartRef, windowSize } = useDispatchWindowSize();
  const [windowStartId, setWindowStartId] = useState<number | null>(null);
  const { visible, startIndex, endIndex, selectedIndex } = useMemo(
    () => resolveDispatchWindow(records, windowStartId, selectedId, windowSize),
    [records, selectedId, windowSize, windowStartId],
  );
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
      nextStartIndex = Math.max(0, index - windowSize + 1);
    }

    setWindowStartId(index === records.length - 1 ? null : (records[nextStartIndex]?.id ?? null));
    onSelect(target.id);
  };

  return (
    <section className="pm-chart-wrap">
      <div className="pm-chart-header">
        <span className="pm-section-title">Dispatch timeline</span>
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
        <div className="pm-chart-legend">
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
        data-selected-id={selectedId}
        data-window-size={windowSize}
        ref={chartRef}
      >
        <div
          className="pm-dispatch-chart-plot"
          data-window-end-id={visible.at(-1)?.id}
          data-window-start-id={visible.at(0)?.id}
          style={{ inlineSize: `${visible.length * DISPATCH_SLOT_WIDTH}px` }}
        >
          <Chart
            ariaDescription="State apply, view update, dispatchTransaction handler, and remaining work for recent dispatches."
            ariaLabel="Dispatch duration bar chart"
            definition={definition}
            height={148}
            initialWidth={DISPATCH_CHART_INITIAL_WIDTH}
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
