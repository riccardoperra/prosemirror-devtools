import type { EditorState, Transaction } from "prosemirror-state";

import { createDevtoolsSessionId } from "../session-id";
import type { DevtoolsPerformanceExtensionOptions, DevtoolsTransactionRecorder } from "../types";
import type { ActiveTransactionMeasurements } from "./active-measurements";
import type { InstanceStore } from "./instance-store";
import type { PerformanceEntryStore } from "./performance-entries";
import { createTransactionRecord } from "./transaction-record";

/**
 * Records ProseMirror transactions and owns their notification batch boundary.
 *
 * The boundary lives here because this layer knows when a dispatch actually begins and finishes,
 * including nested dispatches. Store values remain readable immediately throughout recording,
 * while subscribers are notified once the outermost dispatch has a complete before/after snapshot
 * and all timing data. A panel hook cannot reconstruct this reliably: notifications may also be
 * consumed outside React, and nested dispatches finish inside-out.
 */
export function createTransactionRecorder({
  activeMeasurements,
  instanceStore,
  performanceEntries,
}: {
  activeMeasurements: ActiveTransactionMeasurements;
  instanceStore: InstanceStore;
  performanceEntries: PerformanceEntryStore;
}): DevtoolsTransactionRecorder {
  return {
    beginTransaction(
      instanceId: string,
      transaction: Transaction,
      beforeState: EditorState,
      performanceMarks = true,
      performanceExtension?: boolean | DevtoolsPerformanceExtensionOptions,
      sessionId?: string,
    ) {
      // Open before measuring anything so every write caused by this dispatch belongs to the same
      // atomic notification. A nested dispatch simply increases the scheduler's nesting depth.
      instanceStore.beginBatch();
      try {
        const registered = instanceStore.getEntry(instanceId);
        const instance = !sessionId || registered?.sessionId === sessionId ? registered : undefined;
        return activeMeasurements.begin({
          instanceId,
          sessionId: sessionId ?? registered?.sessionId ?? createDevtoolsSessionId("orphan"),
          id: instance ? ++instance.dispatchCount : 0,
          instanceLabel: instance?.label ?? instanceId,
          transaction,
          beforeState,
          performanceMarks,
          ...(performanceExtension === undefined ? {} : { performanceExtension }),
        });
      } catch (error) {
        // Setup failure means finishTransaction will never receive this measurement, so release the
        // batch here rather than suppressing future notifications indefinitely.
        instanceStore.endBatch();
        throw error;
      }
    },
    recordPhase: activeMeasurements.recordPhase,
    finishTransaction(measurement, result) {
      try {
        const { internal, totalDuration } = activeMeasurements.finish(measurement);
        const instance = instanceStore.getEntry(internal.instanceId);
        if (!instance || instance.sessionId !== internal.sessionId) {
          if (internal.measureName) globalThis.performance?.clearMeasures?.(internal.measureName);
          return null;
        }

        const record = createTransactionRecord({
          id: internal.id,
          instanceId: internal.instanceId,
          sessionId: internal.sessionId,
          timestamp: internal.startedAt,
          totalDuration,
          beforeState: internal.beforeState,
          stateAfter: result.stateAfter,
          rootTransaction: internal.transaction,
          appliedTransactions: result.appliedTransactions,
          phases: internal.phases,
          phaseTimings: internal.phaseTimings,
          timings: internal.timings,
          markers: internal.markers,
          measureName: internal.measureName,
          error: result.error,
        });
        performanceEntries.emit(record, internal);
        instanceStore.recordTransaction(instance, record, {
          sequence: internal.captureSequence,
          event: {
            instanceId: internal.instanceId,
            sessionId: internal.sessionId,
            record,
            transaction: internal.transaction,
            beforeState: internal.beforeState,
            stateAfter: result.stateAfter,
            appliedTransactions: result.appliedTransactions,
          },
        });
        return record;
      } finally {
        // Close on successful, orphaned, and exceptional paths. Only the outermost close publishes
        // the queued values and restores nested dispatch events to their capture order.
        instanceStore.endBatch();
      }
    },
  };
}
