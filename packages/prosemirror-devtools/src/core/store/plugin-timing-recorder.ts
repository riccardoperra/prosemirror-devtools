import type { DevtoolsPluginTimingRecorder, PluginHook } from "../types";
import type { ActiveTransactionMeasurements } from "./active-measurements";
import type { InternalInstance } from "./instance-store";
import { recordPluginTiming, type PluginTimingAggregates } from "./plugin-timings";
import { monotonicNow } from "./transaction-measurement";

export interface PluginTimingRecorder extends DevtoolsPluginTimingRecorder {
  consumeStartupTimings(instanceId: string, sessionId: string): PluginTimingAggregates;
  clearStartupTimings(instanceId: string, sessionId: string): void;
}

function isStartupHook(hook: PluginHook): boolean {
  return hook === "state.init" || hook === "view.create";
}

function mergeAggregates(
  sources: readonly (PluginTimingAggregates | undefined)[],
): PluginTimingAggregates {
  const merged: PluginTimingAggregates = new Map();
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of source) {
      const existing = merged.get(key);
      merged.set(
        key,
        existing
          ? {
              ...existing,
              pluginLabel: value.pluginLabel,
              count: existing.count + value.count,
              total: existing.total + value.total,
              max: Math.max(existing.max, value.max),
              last: value.last,
            }
          : { ...value },
      );
    }
  }
  return merged;
}

export function createPluginTimingRecorder({
  activeMeasurements,
  getInstance,
  onTimingRecorded,
}: {
  activeMeasurements: ActiveTransactionMeasurements;
  getInstance(instanceId: string): InternalInstance | undefined;
  onTimingRecorded(instance: InternalInstance): void;
}): PluginTimingRecorder {
  // These hooks run before the editor view can be registered with the store.
  const startupTimings = new Map<string, Map<string | undefined, PluginTimingAggregates>>();

  const clearStartupTimings = (instanceId: string, sessionId: string): void => {
    const timingsBySession = startupTimings.get(instanceId);
    if (!timingsBySession) return;
    timingsBySession.delete(sessionId);
    if (timingsBySession.size === 0) startupTimings.delete(instanceId);
  };

  return {
    measurePluginHook(instanceId, pluginKey, pluginLabel, hook, run, sessionId) {
      const startedAt = monotonicNow();
      try {
        return run();
      } finally {
        const duration = Math.max(0, monotonicNow() - startedAt);
        const registered = getInstance(instanceId);
        const instance = !sessionId || registered?.sessionId === sessionId ? registered : undefined;
        if (instance || (!registered && isStartupHook(hook))) {
          let aggregates: PluginTimingAggregates;
          if (instance) {
            aggregates = instance.pluginTimings;
          } else {
            const timingsBySession = startupTimings.get(instanceId) ?? new Map();
            aggregates = timingsBySession.get(sessionId) ?? new Map();
            timingsBySession.set(sessionId, aggregates);
            startupTimings.set(instanceId, timingsBySession);
          }
          recordPluginTiming(aggregates, pluginKey, pluginLabel, hook, duration);

          const measurement = activeMeasurements.current(instanceId, sessionId);
          if (measurement) {
            measurement.timings.push({
              pluginKey,
              pluginLabel,
              hook,
              duration,
              startOffset: Math.max(0, startedAt - measurement.clockStartedAt),
            });
          } else if (instance) {
            onTimingRecorded(instance);
          }
        }
      }
    },
    consumeStartupTimings(instanceId, sessionId) {
      const timingsBySession = startupTimings.get(instanceId);
      const timings = mergeAggregates([
        timingsBySession?.get(undefined),
        timingsBySession?.get(sessionId),
      ]);
      timingsBySession?.delete(undefined);
      timingsBySession?.delete(sessionId);
      if (timingsBySession?.size === 0) startupTimings.delete(instanceId);
      return timings;
    },
    clearStartupTimings,
  };
}
