import type { DevtoolsMarker, DevtoolsMarkerRecorder } from "../types";
import type { ActiveTransactionMeasurements } from "./active-measurements";
import { monotonicNow } from "./transaction-measurement";

export function createMarkerRecorder(
  activeMeasurements: ActiveTransactionMeasurements,
): DevtoolsMarkerRecorder {
  return {
    addMarker(instanceId, label, options = {}) {
      const measurement = activeMeasurements.current(instanceId);
      if (!measurement) return false;
      measurement.markers.push({
        label,
        category: options.category ?? null,
        tone: options.tone ?? "neutral",
        startOffset: Math.max(0, monotonicNow() - measurement.clockStartedAt),
        duration: null,
        ...(options.data === undefined ? {} : { data: options.data }),
      });
      return true;
    },
    measureMarker(instanceId, label, run, options = {}) {
      const measurement = activeMeasurements.current(instanceId);
      if (!measurement) return run();
      const startedAt = monotonicNow();
      const marker: DevtoolsMarker = {
        label,
        category: options.category ?? null,
        tone: options.tone ?? "neutral",
        startOffset: Math.max(0, startedAt - measurement.clockStartedAt),
        duration: 0,
        ...(options.data === undefined ? {} : { data: options.data }),
      };
      measurement.markers.push(marker);
      try {
        return run();
      } finally {
        marker.duration = Math.max(0, monotonicNow() - startedAt);
      }
    },
  };
}
