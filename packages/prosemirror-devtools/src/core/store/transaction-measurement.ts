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
  captureSequence: number;
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
};

export function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function canMeasurePerformance(): boolean {
  return typeof globalThis.performance?.measure === "function";
}

function encodeMeasurePart(value: string): string {
  try {
    return encodeURIComponent(value);
  } catch {
    return Array.from(
      { length: value.length },
      (_, index) => `%u${value.charCodeAt(index).toString(16).padStart(4, "0")}`,
    ).join("");
  }
}

export function createTransactionMeasurement({
  instanceId,
  sessionId,
  id,
  captureSequence,
  instanceLabel,
  transaction,
  beforeState,
  performanceMarks,
  performanceExtension,
}: {
  instanceId: string;
  sessionId: string;
  id: number;
  captureSequence: number;
  instanceLabel: string;
  transaction: Transaction;
  beforeState: EditorState;
  performanceMarks: boolean;
  performanceExtension?: boolean | DevtoolsPerformanceExtensionOptions;
}): InternalTransactionMeasurement {
  const measureName =
    id > 0 && performanceMarks && canMeasurePerformance()
      ? `prosemirror-devtools:${encodeMeasurePart(sessionId)}:${encodeMeasurePart(instanceId)}:dispatch:${id}`
      : null;

  return {
    instanceId,
    sessionId,
    id,
    captureSequence,
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
  if (!measurement.measureName) return totalDuration;

  try {
    globalThis.performance.measure(measurement.measureName, {
      start: measurement.clockStartedAt,
      duration: totalDuration,
    });
  } catch {
    // User Timing is optional and must never interfere with editor dispatch.
  }
  return totalDuration;
}
