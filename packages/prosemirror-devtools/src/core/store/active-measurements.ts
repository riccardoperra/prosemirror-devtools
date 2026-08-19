import type { EditorState, Transaction } from "prosemirror-state";

import type { DevtoolsPerformanceExtensionOptions, TransactionMeasurement } from "../types";
import {
  createTransactionMeasurement,
  finishTransactionClock,
  recordTransactionPhase,
  type InternalTransactionMeasurement,
} from "./transaction-measurement";

export interface ActiveTransactionMeasurements {
  begin(options: {
    instanceId: string;
    sessionId: string;
    id: number;
    instanceLabel: string;
    transaction: Transaction;
    beforeState: EditorState;
    performanceMarks: boolean;
    performanceExtension?: boolean | DevtoolsPerformanceExtensionOptions;
  }): TransactionMeasurement;
  finish(measurement: TransactionMeasurement): {
    internal: InternalTransactionMeasurement;
    totalDuration: number;
  };
  recordPhase(
    measurement: TransactionMeasurement,
    phase: "apply" | "viewUpdate" | "customDispatch",
    duration: number,
    startedAt?: number,
  ): void;
  current(instanceId: string, sessionId?: string): InternalTransactionMeasurement | undefined;
  clearInstance(instanceId: string): void;
  clearSession(instanceId: string, sessionId: string): void;
}

/** Tracks synchronous dispatch measurements that have started but not finished. */
export function createActiveTransactionMeasurements(): ActiveTransactionMeasurements {
  // A plugin can synchronously trigger another dispatch, so each editor needs a stack.
  const activeByInstance = new Map<string, InternalTransactionMeasurement[]>();
  // Nested dispatches finish inside-out; this preserves their original begin order.
  let captureSequence = 0;

  const current = (
    instanceId: string,
    sessionId?: string,
  ): InternalTransactionMeasurement | undefined => {
    const active = activeByInstance.get(instanceId);
    if (!active) return undefined;
    if (!sessionId) return active.at(-1);

    for (let index = active.length - 1; index >= 0; index -= 1) {
      const measurement = active[index];
      if (measurement?.sessionId === sessionId) return measurement;
    }
    return undefined;
  };

  return {
    begin(options) {
      const measurement = createTransactionMeasurement({
        ...options,
        captureSequence: ++captureSequence,
      });
      const active = activeByInstance.get(options.instanceId) ?? [];
      active.push(measurement);
      activeByInstance.set(options.instanceId, active);
      return measurement;
    },
    finish(measurement) {
      const internal = measurement as InternalTransactionMeasurement;
      const active = activeByInstance.get(internal.instanceId);
      if (active) {
        const index = active.lastIndexOf(internal);
        if (index >= 0) active.splice(index, 1);
        if (active.length === 0) activeByInstance.delete(internal.instanceId);
      }
      return { internal, totalDuration: finishTransactionClock(internal) };
    },
    recordPhase(measurement, phase, duration, startedAt) {
      recordTransactionPhase(
        measurement as InternalTransactionMeasurement,
        phase,
        duration,
        startedAt,
      );
    },
    current,
    clearInstance(instanceId) {
      activeByInstance.delete(instanceId);
    },
    clearSession(instanceId, sessionId) {
      const active = activeByInstance.get(instanceId);
      if (!active) return;
      const remaining = active.filter((measurement) => measurement.sessionId !== sessionId);
      if (remaining.length > 0) activeByInstance.set(instanceId, remaining);
      else activeByInstance.delete(instanceId);
    },
  };
}
