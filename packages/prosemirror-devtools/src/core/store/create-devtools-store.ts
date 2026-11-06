import { createDevtoolsSessionId } from "../session-id";
import { getDiagnosticsRecorder } from "../diagnostics";
import type { DevtoolsStore, RegisterProseMirrorInstanceOptions } from "../types";
import { createActiveTransactionMeasurements } from "./active-measurements";
import { createInstanceStore } from "./instance-store";
import { createMarkerRecorder } from "./marker-recorder";
import { createPerformanceEntryStore } from "./performance-entries";
import { createPluginTimingRecorder } from "./plugin-timing-recorder";
import { createTransactionRecorder } from "./transaction-recorder";

/**
 * Composes one instance store with independent transaction, timing, and marker recorders.
 *
 * The transaction recorder owns the paired notification batch because it knows the true nested
 * begin/finish lifecycle. The instance store owns immediate values and committed delivery. This
 * split keeps flushing internal: consumers only subscribe and always receive coherent updates.
 */
export function createProseMirrorDevtoolsStore(options: { sourceId?: string } = {}): DevtoolsStore {
  const sourceId = options.sourceId ?? createDevtoolsSessionId("source");
  const activeMeasurements = createActiveTransactionMeasurements();
  const performanceEntries = createPerformanceEntryStore();
  const instanceStore = createInstanceStore({
    sourceId,
    clearRecords(records) {
      for (const record of records) performanceEntries.clear(record);
    },
    onRemove: activeMeasurements.clearInstance,
  });
  const pluginTimingRecorder = createPluginTimingRecorder({
    activeMeasurements,
    getInstance: instanceStore.getEntry,
    onTimingRecorded: instanceStore.markChanged,
  });
  const transactionRecorder = createTransactionRecorder({
    activeMeasurements,
    instanceStore,
    performanceEntries,
  });
  const markerRecorder = createMarkerRecorder(activeMeasurements);

  const register = (options: RegisterProseMirrorInstanceOptions): (() => void) => {
    const existing = instanceStore.getEntry(options.id);
    const sessionId =
      options.sessionId ?? existing?.sessionId ?? createDevtoolsSessionId("registration");
    const initialPluginTimings =
      existing?.pluginTimings ?? pluginTimingRecorder.consumeStartupTimings(options.id, sessionId);
    const release = instanceStore.register({ ...options, sessionId }, initialPluginTimings);
    getDiagnosticsRecorder(options.diagnostics)?.observeDocument(options.view.state.doc);
    return release;
  };

  const closeSession = (instanceId: string, sessionId: string): void => {
    pluginTimingRecorder.clearStartupTimings(instanceId, sessionId);
    if (instanceStore.getEntry(instanceId)?.sessionId !== sessionId) {
      activeMeasurements.clearSession(instanceId, sessionId);
    }
  };

  return {
    sourceId,
    getSnapshot: instanceStore.getSnapshot,
    subscribe: instanceStore.subscribe,
    getActiveInstanceId: instanceStore.getActiveInstanceId,
    subscribeActiveInstance: instanceStore.subscribeActiveInstance,
    getInstanceDescriptors: instanceStore.getInstanceDescriptors,
    subscribeInstanceDescriptors: instanceStore.subscribeInstanceDescriptors,
    getInstance: instanceStore.getInstance,
    subscribeInstance: instanceStore.subscribeInstance,
    subscribeDispatch: instanceStore.subscribeDispatch,
    register,
    unregister: instanceStore.unregister,
    setActiveInstance: instanceStore.setActiveInstance,
    clearTransactions: instanceStore.clearTransactions,
    pauseCapture: instanceStore.pauseCapture,
    resumeCapture: instanceStore.resumeCapture,
    closeSession,
    beginTransaction: transactionRecorder.beginTransaction,
    recordPhase: transactionRecorder.recordPhase,
    finishTransaction: transactionRecorder.finishTransaction,
    measurePluginHook: pluginTimingRecorder.measurePluginHook,
    observeFilter: pluginTimingRecorder.observeFilter,
    observeAppend: pluginTimingRecorder.observeAppend,
    addMarker: markerRecorder.addMarker,
    measureMarker: markerRecorder.measureMarker,
  };
}

export const prosemirrorDevtoolsStore = createProseMirrorDevtoolsStore();
