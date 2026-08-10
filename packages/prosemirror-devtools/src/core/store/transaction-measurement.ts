import type { EditorState, Transaction } from "prosemirror-state";

import {
  resolvePerformanceExtensionOptions,
  type PerformancePhaseTiming,
  type ResolvedPerformanceExtensionOptions,
} from "../performance-extension";
import type {
  DevtoolsMarker,
  DevtoolsPerformanceExtensionOptions,
  PluginTiming,
  TransactionMeasurement,
} from "../types";

export type InternalTransactionMeasurement = TransactionMeasurement & {
  clockStartedAt: number;
  timings: PluginTiming[];
  markers: DevtoolsMarker[];
  phases: {
    apply: number | null;
    viewUpdate: number | null;
    customDispatch: number | null;
  };
  phaseTimings: PerformancePhaseTiming[];
  performanceExtension: ResolvedPerformanceExtensionOptions | null;
  measureName: string | null;
  startMark: string | null;
};

export function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function canMarkPerformance(): boolean {
  return Boolean(
    globalThis.performance &&
    typeof globalThis.performance.mark === "function" &&
    typeof globalThis.performance.measure === "function",
  );
}

function sanitizeMarkPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export function createTransactionMeasurement({
  instanceId,
  id,
  instanceLabel,
  transaction,
  beforeState,
  performanceMarks,
  performanceExtension,
}: {
  instanceId: string;
  id: number;
  instanceLabel: string;
  transaction: Transaction;
  beforeState: EditorState;
  performanceMarks: boolean;
  performanceExtension?: boolean | DevtoolsPerformanceExtensionOptions;
}): InternalTransactionMeasurement {
  let measureName =
    id > 0 && performanceMarks && canMarkPerformance()
      ? `prosemirror-devtools:${sanitizeMarkPart(instanceId)}:dispatch:${id}`
      : null;
  let startMark = measureName ? `${measureName}:start` : null;
  if (startMark) {
    try {
      globalThis.performance.mark(startMark);
    } catch {
      measureName = null;
      startMark = null;
    }
  }

  return {
    instanceId,
    id,
    startedAt: Date.now(),
    clockStartedAt: monotonicNow(),
    beforeState,
    transaction,
    timings: [],
    markers: [],
    phases: { apply: null, viewUpdate: null, customDispatch: null },
    phaseTimings: [],
    performanceExtension: resolvePerformanceExtensionOptions(performanceExtension, instanceLabel),
    measureName,
    startMark,
  };
}

export function recordTransactionPhase(
  measurement: InternalTransactionMeasurement,
  phase: "apply" | "viewUpdate" | "customDispatch",
  duration: number,
  startedAt?: number,
): void {
  const safeDuration = Math.max(0, duration);
  measurement.phases[phase] = (measurement.phases[phase] ?? 0) + safeDuration;
  if (startedAt == null) return;
  measurement.phaseTimings.push({
    phase,
    startOffset: Math.max(0, startedAt - measurement.clockStartedAt),
    duration: safeDuration,
  });
}

export function finishTransactionClock(measurement: InternalTransactionMeasurement): number {
  const totalDuration = Math.max(0, monotonicNow() - measurement.clockStartedAt);
  if (!measurement.measureName || !measurement.startMark) return totalDuration;

  const endMark = `${measurement.measureName}:end`;
  try {
    globalThis.performance.mark(endMark);
    globalThis.performance.measure(measurement.measureName, measurement.startMark, endMark);
  } catch {
    // User Timing is optional and must never interfere with editor dispatch.
  } finally {
    globalThis.performance.clearMarks?.(measurement.startMark);
    globalThis.performance.clearMarks?.(endMark);
  }
  return totalDuration;
}
