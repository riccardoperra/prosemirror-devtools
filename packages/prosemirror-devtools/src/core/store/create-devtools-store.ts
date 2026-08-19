import type { EditorState, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import type {
  DevtoolsDispatchEvent,
  DevtoolsDispatchListener,
  DevtoolsInstanceDescriptor,
  DevtoolsMarker,
  DevtoolsMarkerOptions,
  DevtoolsPerformanceExtensionOptions,
  DevtoolsSnapshot,
  DevtoolsStore,
  FinishTransactionMeasurement,
  PluginHook,
  RegisterProseMirrorInstanceOptions,
  RegisteredProseMirrorInstance,
  TransactionMeasurement,
  TransactionRecord,
} from "../types";
import { createDevtoolsSessionId } from "../session-id";
import { createPerformanceEntryStore } from "./performance-entries";
import {
  readPluginTimingSummaries,
  recordPluginTiming,
  type PluginTimingAggregates,
} from "./plugin-timings";
import {
  createTransactionMeasurement,
  finishTransactionClock,
  monotonicNow,
  recordTransactionPhase,
  type InternalTransactionMeasurement,
} from "./transaction-measurement";
import { createTransactionRecord } from "./transaction-record";

type Listener = () => void;

type InternalInstanceState = {
  id: string;
  sessionId: string;
  label: string;
  view: EditorView;
  registeredAt: number;
  updatedAt: number;
  dispatchCount: number;
  transactionLimit: number | null;
  registrationCount: number;
  transactions: TransactionRecord[];
  pluginTimings: PluginTimingAggregates;
};

type InternalInstance = InternalInstanceState & {
  snapshot: RegisteredProseMirrorInstance;
};

const EMPTY_SNAPSHOT: DevtoolsSnapshot = {
  activeInstanceId: null,
  instances: [],
  version: 0,
};

function notify(listeners: ReadonlySet<Listener>): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error("[prosemirror-devtools] Store subscriber failed", error);
    }
  }
}

function notifyDispatch(
  listeners: ReadonlySet<DevtoolsDispatchListener>,
  events: readonly DevtoolsDispatchEvent[],
): void {
  for (const listener of listeners) {
    try {
      listener(events);
    } catch (error) {
      console.error("[prosemirror-devtools] Dispatch subscriber failed", error);
    }
  }
}

function resolveTransactionLimit(
  value: number | null | undefined,
  fallback: number | null,
): number | null {
  if (value === undefined) return fallback;
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(1, Math.floor(value));
}

function createInstanceSnapshot(entry: InternalInstanceState): RegisteredProseMirrorInstance {
  return {
    id: entry.id,
    label: entry.label,
    view: entry.view,
    registeredAt: entry.registeredAt,
    updatedAt: entry.updatedAt,
    dispatchCount: entry.dispatchCount,
    transactionLimit: entry.transactionLimit,
    transactions: entry.transactions,
    pluginTimings: readPluginTimingSummaries(entry.pluginTimings),
  };
}

function mergePluginTimingAggregates(
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

function isStartupPluginHook(hook: PluginHook): boolean {
  return hook === "state.init" || hook === "view.create";
}

/**
 * Creates an isolated devtools store. Runtime state stays private to this
 * closure; integrations depend only on the small capabilities in DevtoolsStore.
 */
export function createProseMirrorDevtoolsStore(): DevtoolsStore {
  const instances = new Map<string, InternalInstance>();
  const startupPluginTimings = new Map<string, Map<string | undefined, PluginTimingAggregates>>();
  const frames = new Map<string, InternalTransactionMeasurement[]>();
  const listeners = new Set<Listener>();
  const activeInstanceListeners = new Set<Listener>();
  const descriptorListeners = new Set<Listener>();
  const instanceListeners = new Map<string, Set<Listener>>();
  const dispatchListeners = new Set<DevtoolsDispatchListener>();
  const performanceEntries = createPerformanceEntryStore();

  let activeInstanceId: string | null = null;
  let captureSequence = 0;
  let version = 0;
  let snapshot: DevtoolsSnapshot = EMPTY_SNAPSHOT;
  let descriptors: readonly DevtoolsInstanceDescriptor[] = [];
  let notificationScheduled = false;
  const changedInstanceIds = new Set<string>();
  const queuedDispatches: Array<{
    sequence: number;
    event: DevtoolsDispatchEvent;
  }> = [];

  const rebuildSnapshot = (): void => {
    version += 1;
    snapshot = {
      activeInstanceId,
      instances: Array.from(instances.values(), (entry) => entry.snapshot),
      version,
    };
  };

  const rebuildDescriptors = (): void => {
    descriptors = Array.from(instances.values(), ({ id, label }) => ({ id, label }));
  };

  const refreshInstanceSnapshot = (entry: InternalInstance): void => {
    entry.snapshot = createInstanceSnapshot(entry);
  };

  const flush = (): void => {
    if (!notificationScheduled) return;

    notificationScheduled = false;
    const dispatches = queuedDispatches.splice(0).sort((left, right) => {
      return left.sequence - right.sequence;
    });
    const instanceIds = Array.from(changedInstanceIds);
    changedInstanceIds.clear();

    notify(listeners);
    for (const instanceId of instanceIds) {
      const subscriptions = instanceListeners.get(instanceId);
      if (subscriptions) notify(subscriptions);
    }
    if (dispatches.length > 0 && dispatchListeners.size > 0) {
      notifyDispatch(
        dispatchListeners,
        dispatches.map(({ event }) => event),
      );
    }
  };

  const scheduleFlush = (): void => {
    if (notificationScheduled) return;
    notificationScheduled = true;
    queueMicrotask(flush);
  };

  const publish = ({
    instanceId,
    descriptorsChanged = false,
    activeInstanceChanged = false,
  }: {
    instanceId?: string;
    descriptorsChanged?: boolean;
    activeInstanceChanged?: boolean;
  } = {}): void => {
    if (descriptorsChanged) rebuildDescriptors();
    rebuildSnapshot();
    notify(listeners);
    if (descriptorsChanged) notify(descriptorListeners);
    if (activeInstanceChanged) notify(activeInstanceListeners);
    if (instanceId !== undefined) {
      const subscriptions = instanceListeners.get(instanceId);
      if (subscriptions) notify(subscriptions);
    }
  };

  const scheduleInstanceUpdate = (entry: InternalInstance): void => {
    refreshInstanceSnapshot(entry);
    rebuildSnapshot();
    changedInstanceIds.add(entry.id);
    scheduleFlush();
  };

  const clearRecords = (records: readonly TransactionRecord[]): void => {
    for (const record of records) {
      performanceEntries.clear(record);
    }
  };

  const removeStartupTimings = (instanceId: string, sessionId?: string): void => {
    const timingsBySession = startupPluginTimings.get(instanceId);
    if (!timingsBySession) return;
    timingsBySession.delete(sessionId);
    if (timingsBySession.size === 0) startupPluginTimings.delete(instanceId);
  };

  const register = (options: RegisterProseMirrorInstanceOptions): (() => void) => {
    flush();
    const existing = instances.get(options.id);
    if (existing && existing.view !== options.view) {
      throw new Error(
        `A ProseMirror editor with id "${options.id}" is already registered. ` +
          "Use a unique id or detach the previous editor first.",
      );
    }

    const registeredAt = Date.now();
    let descriptorsChanged = !existing;
    let entry: InternalInstance;
    if (existing) {
      if (options.sessionId && options.sessionId !== existing.sessionId) {
        throw new Error(
          `The ProseMirror editor "${options.id}" is already registered in another devtools session.`,
        );
      }
      const nextLabel = options.label ?? existing.label;
      descriptorsChanged = nextLabel !== existing.label;
      existing.label = nextLabel;
      existing.transactionLimit = resolveTransactionLimit(
        options.transactionLimit,
        existing.transactionLimit,
      );
      existing.registrationCount += 1;
      if (
        existing.transactionLimit !== null &&
        existing.transactions.length > existing.transactionLimit
      ) {
        const removed = existing.transactions.slice(
          0,
          existing.transactions.length - existing.transactionLimit,
        );
        clearRecords(removed);
        existing.transactions = existing.transactions.slice(-existing.transactionLimit);
      }
      existing.updatedAt = registeredAt;
      entry = existing;
      refreshInstanceSnapshot(entry);
    } else {
      const sessionId = options.sessionId ?? createDevtoolsSessionId("registration");
      const timingsBySession = startupPluginTimings.get(options.id);
      const pluginTimings = mergePluginTimingAggregates([
        timingsBySession?.get(undefined),
        timingsBySession?.get(sessionId),
      ]);
      const initial: InternalInstanceState = {
        id: options.id,
        sessionId,
        label: options.label ?? options.id,
        view: options.view,
        registeredAt,
        updatedAt: registeredAt,
        dispatchCount: 0,
        transactionLimit: resolveTransactionLimit(options.transactionLimit, null),
        registrationCount: 1,
        transactions: [],
        pluginTimings,
      };
      entry = {
        ...initial,
        snapshot: createInstanceSnapshot(initial),
      };
      instances.set(options.id, entry);
      removeStartupTimings(options.id);
      removeStartupTimings(options.id, sessionId);
    }

    const activeInstanceChanged = activeInstanceId === null;
    activeInstanceId ??= options.id;
    publish({ instanceId: options.id, descriptorsChanged, activeInstanceChanged });

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      releaseRegistration(options.id, options.view);
    };
  };

  const removeRegistration = (id: string, view?: EditorView): void => {
    const current = instances.get(id);
    if (!current || (view && current.view !== view)) return;
    clearRecords(current.transactions);
    instances.delete(id);
    frames.delete(id);
    const activeInstanceChanged = activeInstanceId === id;
    if (activeInstanceChanged) activeInstanceId = instances.keys().next().value ?? null;
    publish({ instanceId: id, descriptorsChanged: true, activeInstanceChanged });
  };

  const releaseRegistration = (id: string, view: EditorView): void => {
    flush();
    const current = instances.get(id);
    if (!current || current.view !== view) return;
    current.registrationCount -= 1;
    if (current.registrationCount <= 0) removeRegistration(id, view);
  };

  const unregister = (id: string, view?: EditorView): void => {
    flush();
    removeRegistration(id, view);
  };

  const closeSession = (instanceId: string, sessionId: string): void => {
    flush();
    removeStartupTimings(instanceId, sessionId);
    if (instances.get(instanceId)?.sessionId === sessionId) return;
    const instanceFrames = frames.get(instanceId);
    if (!instanceFrames) return;
    const remaining = instanceFrames.filter((frame) => frame.sessionId !== sessionId);
    if (remaining.length > 0) frames.set(instanceId, remaining);
    else frames.delete(instanceId);
  };

  const setActiveInstance = (id: string): void => {
    flush();
    if (!instances.has(id)) {
      throw new Error(`Cannot activate unknown ProseMirror editor "${id}".`);
    }
    if (activeInstanceId === id) return;
    activeInstanceId = id;
    publish({ activeInstanceChanged: true });
  };

  const clearTransactions = (id: string): void => {
    flush();
    const entry = instances.get(id);
    if (!entry) return;
    clearRecords(entry.transactions);
    entry.transactions = [];
    entry.pluginTimings.clear();
    entry.updatedAt = Date.now();
    refreshInstanceSnapshot(entry);
    publish({ instanceId: id });
  };

  const beginTransaction = (
    instanceId: string,
    transaction: Transaction,
    beforeState: EditorState,
    performanceMarks = true,
    performanceExtension?: boolean | DevtoolsPerformanceExtensionOptions,
    sessionId?: string,
  ): TransactionMeasurement => {
    const entry = instances.get(instanceId);
    const resolvedSessionId = sessionId ?? entry?.sessionId ?? createDevtoolsSessionId("orphan");
    const activeEntry = !sessionId || entry?.sessionId === sessionId ? entry : undefined;
    const measurement = createTransactionMeasurement({
      instanceId,
      sessionId: resolvedSessionId,
      id: activeEntry ? ++activeEntry.dispatchCount : 0,
      captureSequence: ++captureSequence,
      instanceLabel: activeEntry?.label ?? instanceId,
      transaction,
      beforeState,
      performanceMarks,
      ...(performanceExtension === undefined ? {} : { performanceExtension }),
    });
    const instanceFrames = frames.get(instanceId) ?? [];
    instanceFrames.push(measurement);
    frames.set(instanceId, instanceFrames);
    return measurement;
  };

  const recordPhase = (
    measurement: TransactionMeasurement,
    phase: "apply" | "viewUpdate" | "customDispatch",
    duration: number,
    startedAt?: number,
  ): void => {
    recordTransactionPhase(
      measurement as InternalTransactionMeasurement,
      phase,
      duration,
      startedAt,
    );
  };

  const finishTransaction = (
    measurement: TransactionMeasurement,
    result: FinishTransactionMeasurement,
  ): TransactionRecord | null => {
    const internal = measurement as InternalTransactionMeasurement;
    const instanceFrames = frames.get(internal.instanceId);
    if (instanceFrames) {
      const index = instanceFrames.lastIndexOf(internal);
      if (index >= 0) instanceFrames.splice(index, 1);
      if (instanceFrames.length === 0) frames.delete(internal.instanceId);
    }

    const totalDuration = finishTransactionClock(internal);
    const entry = instances.get(internal.instanceId);
    if (!entry || entry.sessionId !== internal.sessionId) {
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
    const transactions = [...entry.transactions];
    const insertionIndex = transactions.findIndex((candidate) => candidate.id > record.id);
    if (insertionIndex < 0) transactions.push(record);
    else transactions.splice(insertionIndex, 0, record);
    const overflow =
      entry.transactionLimit === null
        ? 0
        : Math.max(0, transactions.length - entry.transactionLimit);
    if (overflow > 0) clearRecords(transactions.splice(0, overflow));
    entry.transactions = transactions;
    entry.updatedAt = Date.now();
    queuedDispatches.push({
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
    scheduleInstanceUpdate(entry);
    return record;
  };

  const measurePluginHook = <T>(
    instanceId: string,
    pluginKey: string,
    pluginLabel: string,
    hook: PluginHook,
    run: () => T,
    sessionId?: string,
  ): T => {
    const startedAt = monotonicNow();
    try {
      return run();
    } finally {
      const duration = Math.max(0, monotonicNow() - startedAt);
      const registered = instances.get(instanceId);
      const entry = !sessionId || registered?.sessionId === sessionId ? registered : undefined;
      if (entry || (!registered && isStartupPluginHook(hook))) {
        let aggregates: PluginTimingAggregates;
        if (entry) {
          aggregates = entry.pluginTimings;
        } else {
          const timingsBySession = startupPluginTimings.get(instanceId) ?? new Map();
          aggregates = timingsBySession.get(sessionId) ?? new Map();
          timingsBySession.set(sessionId, aggregates);
          startupPluginTimings.set(instanceId, timingsBySession);
        }
        recordPluginTiming(aggregates, pluginKey, pluginLabel, hook, duration);

        const instanceFrames = frames.get(instanceId);
        let frame: InternalTransactionMeasurement | undefined;
        if (instanceFrames) {
          for (let index = instanceFrames.length - 1; index >= 0; index -= 1) {
            const candidate = instanceFrames[index];
            if (candidate && (!sessionId || candidate.sessionId === sessionId)) {
              frame = candidate;
              break;
            }
          }
        }
        if (frame) {
          frame.timings.push({
            pluginKey,
            pluginLabel,
            hook,
            duration,
            startOffset: Math.max(0, startedAt - frame.clockStartedAt),
          });
        } else if (entry) {
          entry.updatedAt = Date.now();
          scheduleInstanceUpdate(entry);
        }
      }
    }
  };

  const addMarker = (
    instanceId: string,
    label: string,
    options: DevtoolsMarkerOptions = {},
  ): boolean => {
    const frame = frames.get(instanceId)?.at(-1);
    if (!frame) return false;
    frame.markers.push({
      label,
      category: options.category ?? null,
      tone: options.tone ?? "neutral",
      startOffset: Math.max(0, monotonicNow() - frame.clockStartedAt),
      duration: null,
      ...(options.data === undefined ? {} : { data: options.data }),
    });
    return true;
  };

  const measureMarker = <T>(
    instanceId: string,
    label: string,
    run: () => T,
    options: DevtoolsMarkerOptions = {},
  ): T => {
    const frame = frames.get(instanceId)?.at(-1);
    if (!frame) return run();
    const startedAt = monotonicNow();
    const marker: DevtoolsMarker = {
      label,
      category: options.category ?? null,
      tone: options.tone ?? "neutral",
      startOffset: Math.max(0, startedAt - frame.clockStartedAt),
      duration: 0,
      ...(options.data === undefined ? {} : { data: options.data }),
    };
    frame.markers.push(marker);
    try {
      return run();
    } finally {
      marker.duration = Math.max(0, monotonicNow() - startedAt);
    }
  };

  const subscribeInstance = (id: string, listener: Listener): (() => void) => {
    const subscriptions = instanceListeners.get(id) ?? new Set();
    subscriptions.add(listener);
    instanceListeners.set(id, subscriptions);
    return () => {
      subscriptions.delete(listener);
      if (subscriptions.size === 0) instanceListeners.delete(id);
    };
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getActiveInstanceId: () => activeInstanceId,
    subscribeActiveInstance(listener) {
      activeInstanceListeners.add(listener);
      return () => activeInstanceListeners.delete(listener);
    },
    getInstanceDescriptors: () => descriptors,
    subscribeInstanceDescriptors(listener) {
      descriptorListeners.add(listener);
      return () => descriptorListeners.delete(listener);
    },
    getInstance: (id) => instances.get(id)?.snapshot,
    subscribeInstance,
    subscribeDispatch(listener) {
      dispatchListeners.add(listener);
      return () => dispatchListeners.delete(listener);
    },
    register,
    unregister,
    setActiveInstance,
    clearTransactions,
    flush,
    closeSession,
    beginTransaction,
    recordPhase,
    finishTransaction,
    measurePluginHook,
    addMarker,
    measureMarker,
  };
}

export const prosemirrorDevtoolsStore = createProseMirrorDevtoolsStore();
