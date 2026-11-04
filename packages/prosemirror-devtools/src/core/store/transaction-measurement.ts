import type { EditorState, Transaction } from "prosemirror-state";
import type { InspectionEvidence } from "../../inspection/types";

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
  TransactionProvenance,
} from "../types";

export type InternalTransactionMeasurement = TransactionMeasurement & {
  captureSequence: number;
  generation: number | null;
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
  captureDetailed: boolean;
  parentDispatchId: number | null;
  transactionIds: Map<Transaction, number>;
  filters: Array<TransactionProvenance["filters"][number]>;
  appends: Array<TransactionProvenance["appends"][number]>;
  beforeProjections: Map<string, InspectionEvidence>;
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
  generation,
  instanceLabel,
  transaction,
  beforeState,
  performanceMarks,
  performanceExtension,
  captureDetailed = true,
  parentDispatchId = null,
}: {
  instanceId: string;
  sessionId: string;
  id: number;
  captureSequence: number;
  generation: number | null;
  instanceLabel: string;
  transaction: Transaction;
  beforeState: EditorState;
  performanceMarks: boolean;
  performanceExtension?: boolean | DevtoolsPerformanceExtensionOptions;
  captureDetailed?: boolean;
  parentDispatchId?: number | null;
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
    generation,
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
    captureDetailed,
    parentDispatchId,
    transactionIds: new Map([[transaction, 0]]),
    filters: [],
    appends: [],
    beforeProjections: new Map(),
  };
}

export function recordTransactionPhase(
  measurement: InternalTransactionMeasurement,
  phase: "apply" | "viewUpdate" | "customDispatch",
  duration: number,
  startedAt?: number,
): void {
  if (!measurement.captureDetailed) return;
  const safeDuration = Math.max(0, duration);
  measurement.phases[phase] = (measurement.phases[phase] ?? 0) + safeDuration;
  if (startedAt == null) return;
  measurement.phaseTimings.push({
    phase,
    startOffset: Math.max(0, startedAt - measurement.clockStartedAt),
    duration: safeDuration,
  });
}

export function referenceMeasuredTransaction(
  measurement: InternalTransactionMeasurement,
  transaction: Transaction,
): number {
  const existing = measurement.transactionIds.get(transaction);
  if (existing !== undefined) return existing;
  const id = measurement.transactionIds.size;
  measurement.transactionIds.set(transaction, id);
  return id;
}

export function readTransactionProvenance(
  measurement: InternalTransactionMeasurement,
  appliedTransactions: readonly Transaction[] | undefined,
): TransactionProvenance {
  const applied = appliedTransactions ?? [];
  for (const transaction of applied) referenceMeasuredTransaction(measurement, transaction);
  return {
    kind:
      measurement.filters.length > 0 || measurement.appends.length > 0 ? "partial" : "unobserved",
    transactions: Array.from(measurement.transactionIds, ([transaction, id]) => {
      const appliedIndex = applied.indexOf(transaction);
      const append = measurement.appends.find((entry) => entry.outputTransactionId === id);
      return {
        id,
        appliedIndex: appliedIndex < 0 ? null : appliedIndex,
        origin:
          id === 0
            ? { kind: "root" }
            : append
              ? { kind: "append", pluginKey: append.pluginKey }
              : { kind: "unknown" },
      };
    }),
    filters: measurement.filters,
    appends: measurement.appends,
  };
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
