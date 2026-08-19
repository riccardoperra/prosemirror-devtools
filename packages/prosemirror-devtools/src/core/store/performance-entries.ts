import {
  clearPerformanceExtensionEntries,
  emitPerformanceExtensionEntries,
  type PerformanceExtensionEntryReference,
} from "../performance-extension";
import type { TransactionRecord } from "../types";
import type { InternalTransactionMeasurement } from "./transaction-measurement";

export interface PerformanceEntryStore {
  emit(record: TransactionRecord, measurement: InternalTransactionMeasurement): void;
  clear(record: TransactionRecord): void;
}

export function createPerformanceEntryStore(): PerformanceEntryStore {
  const entries = new WeakMap<TransactionRecord, PerformanceExtensionEntryReference[]>();

  return {
    emit(record, measurement) {
      const references = emitPerformanceExtensionEntries(
        record,
        measurement.clockStartedAt,
        measurement.performanceExtension,
        measurement.phaseTimings,
      );
      if (references.length > 0) entries.set(record, references);
    },
    clear(record) {
      if (record.measureName) globalThis.performance?.clearMeasures?.(record.measureName);
      clearPerformanceExtensionEntries(entries.get(record) ?? []);
      entries.delete(record);
    },
  };
}
