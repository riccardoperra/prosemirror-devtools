import type { EditorState, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { serializeValue } from "../serialize";
import type {
  DevtoolsDispatchEvent,
  DevtoolsDispatchListener,
  DevtoolsInstanceDescriptor,
  DevtoolsMarker,
  DevtoolsMarkerOptions,
  DevtoolsPerformanceExtensionOptions,
  DevtoolsSnapshot,
  DevtoolsStore,
  DevtoolsTransactionPage,
  DevtoolsTransactionQuery,
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

function normalizeTransactionLimit(
  value: number | null | undefined,
  fallback: number | null,
): number | null {
  if (value === undefined) return fallback;
  if (value === null || value === Number.POSITIVE_INFINITY) return null;
  if (!Number.isFinite(value)) return 1;
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
    transactions: [...entry.transactions],
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

/**
 * Creates an isolated devtools store. Runtime state stays private to this
 * closure; integrations depend only on the small capabilities in DevtoolsStore.
 */
export function createProseMirrorDevtoolsStore(): DevtoolsStore {
  const instances = new Map<string, InternalInstance>();
  const pendingPluginTimings = new Map<string, PluginTimingAggregates>();
  const closedTimingScopes = new Set<string>();
  const frames = new Map<string, InternalTransactionMeasurement[]>();
  const listeners = new Set<Listener>();
  const activeInstanceListeners = new Set<Listener>();
  const descriptorListeners = new Set<Listener>();
  const instanceListeners = new Map<string, Set<Listener>>();
  const dispatchListeners = new Set<DevtoolsDispatchListener>();
  const performanceEntries = createPerformanceEntryStore();
  const discardedPerformanceRecords = new WeakSet<TransactionRecord>();

  let activeInstanceId: string | null = null;
  let captureSequence = 0;
  let version = 0;
  let snapshot: DevtoolsSnapshot = EMPTY_SNAPSHOT;
  let descriptors: readonly DevtoolsInstanceDescriptor[] = [];
  let notificationScheduled = false;
  let snapshotNeedsRebuild = false;
  let pendingGlobalNotification = false;
  let pendingActiveNotification = false;
  let pendingDescriptorNotification = false;
  const pendingInstanceNotifications = new Set<string>();
  const dirtyInstanceSnapshots = new Set<string>();
  const pendingDispatches: Array<{
    sequence: number;
    event: DevtoolsDispatchEvent;
    measurement: InternalTransactionMeasurement;
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

  const notifyImmediately = ({
    instanceId,
    descriptorsChanged = false,
    activeInstanceChanged = false,
  }: {
    instanceId?: string;
    descriptorsChanged?: boolean;
    activeInstanceChanged?: boolean;
  } = {}): void => {
    notify(listeners);
    if (descriptorsChanged) notify(descriptorListeners);
    if (activeInstanceChanged) notify(activeInstanceListeners);
    const subscriptions = instanceId ? instanceListeners.get(instanceId) : undefined;
    if (subscriptions) notify(subscriptions);
  };

  const materializePendingSnapshots = (): void => {
    for (const instanceId of dirtyInstanceSnapshots) {
      const entry = instances.get(instanceId);
      if (entry) refreshInstanceSnapshot(entry);
    }
    dirtyInstanceSnapshots.clear();
    if (snapshotNeedsRebuild) {
      rebuildSnapshot();
      snapshotNeedsRebuild = false;
    }
  };

  const flush = (): void => {
    if (
      !pendingGlobalNotification &&
      !pendingActiveNotification &&
      !pendingDescriptorNotification &&
      pendingInstanceNotifications.size === 0 &&
      pendingDispatches.length === 0
    ) {
      notificationScheduled = false;
      return;
    }

    notificationScheduled = false;
    const dispatches = pendingDispatches.splice(0).sort((left, right) => {
      return left.sequence - right.sequence;
    });
    const instanceIds = Array.from(pendingInstanceNotifications);
    pendingInstanceNotifications.clear();
    const notifyGlobal = pendingGlobalNotification;
    const notifyActive = pendingActiveNotification;
    const notifyDescriptors = pendingDescriptorNotification;
    pendingGlobalNotification = false;
    pendingActiveNotification = false;
    pendingDescriptorNotification = false;

    if (notifyDescriptors) rebuildDescriptors();
    if (notifyGlobal) materializePendingSnapshots();

    for (const pending of dispatches) {
      if (!discardedPerformanceRecords.has(pending.event.record)) {
        performanceEntries.emit(pending.event.record, pending.measurement);
      }
    }
    if (notifyGlobal) notify(listeners);
    if (notifyDescriptors) notify(descriptorListeners);
    if (notifyActive) notify(activeInstanceListeners);
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
    scheduled = false,
  }: {
    instanceId?: string;
    descriptorsChanged?: boolean;
    activeInstanceChanged?: boolean;
    scheduled?: boolean;
  } = {}): void => {
    if (scheduled) {
      pendingGlobalNotification = true;
      snapshotNeedsRebuild = true;
      pendingDescriptorNotification ||= descriptorsChanged;
      pendingActiveNotification ||= activeInstanceChanged;
      if (instanceId) {
        pendingInstanceNotifications.add(instanceId);
        dirtyInstanceSnapshots.add(instanceId);
      }
      scheduleFlush();
      return;
    }
    if (descriptorsChanged) rebuildDescriptors();
    rebuildSnapshot();
    snapshotNeedsRebuild = false;
    notifyImmediately({
      ...(instanceId === undefined ? {} : { instanceId }),
      descriptorsChanged,
      activeInstanceChanged,
    });
  };

  const refreshInstanceSnapshot = (entry: InternalInstance): void => {
    entry.snapshot = createInstanceSnapshot(entry);
  };

  const clearRecords = (records: readonly TransactionRecord[]): void => {
    for (const record of records) {
      discardedPerformanceRecords.add(record);
      performanceEntries.clear(record);
    }
  };

  const timingScopeKey = (instanceId: string, sessionId: string): string => {
    return `${instanceId}\u0000${sessionId}`;
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
    let descriptorsChanged = existing === undefined;
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
      existing.transactionLimit = normalizeTransactionLimit(
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
    } else {
      const sessionId = options.sessionId ?? createDevtoolsSessionId("registration");
      const pendingKey = timingScopeKey(options.id, sessionId);
      const wildcardPendingKey = timingScopeKey(options.id, "*");
      const pluginTimings = mergePluginTimingAggregates([
        pendingPluginTimings.get(wildcardPendingKey),
        pendingPluginTimings.get(pendingKey),
      ]);
      closedTimingScopes.delete(pendingKey);
      const initial: InternalInstanceState = {
        id: options.id,
        sessionId,
        label: options.label ?? options.id,
        view: options.view,
        registeredAt,
        updatedAt: registeredAt,
        dispatchCount: 0,
        transactionLimit: normalizeTransactionLimit(options.transactionLimit, null),
        registrationCount: 1,
        transactions: [],
        pluginTimings,
      };
      entry = {
        ...initial,
        snapshot: createInstanceSnapshot(initial),
      };
      instances.set(options.id, entry);
      pendingPluginTimings.delete(pendingKey);
      pendingPluginTimings.delete(wildcardPendingKey);
    }
    refreshInstanceSnapshot(entry);

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
    closedTimingScopes.add(timingScopeKey(current.id, current.sessionId));
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
    const key = timingScopeKey(instanceId, sessionId);
    pendingPluginTimings.delete(key);
    if (instances.get(instanceId)?.sessionId === sessionId) return;
    closedTimingScopes.add(key);
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
    const insertionIndex = entry.transactions.findIndex((candidate) => candidate.id > record.id);
    if (insertionIndex < 0) entry.transactions.push(record);
    else entry.transactions.splice(insertionIndex, 0, record);
    const overflow =
      entry.transactionLimit === null
        ? 0
        : Math.max(0, entry.transactions.length - entry.transactionLimit);
    if (overflow > 0) clearRecords(entry.transactions.splice(0, overflow));
    entry.updatedAt = Date.now();
    pendingDispatches.push({
      sequence: internal.captureSequence,
      measurement: internal,
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
    publish({ instanceId: entry.id, scheduled: true });
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
      const pendingKey = timingScopeKey(instanceId, sessionId ?? "*");
      const timingScopeOpen = !sessionId || !closedTimingScopes.has(pendingKey);
      if (timingScopeOpen && (!registered || entry)) {
        const aggregates =
          entry?.pluginTimings ?? pendingPluginTimings.get(pendingKey) ?? new Map();
        if (!entry && !pendingPluginTimings.has(pendingKey)) {
          pendingPluginTimings.set(pendingKey, aggregates);
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
          publish({ instanceId, scheduled: true });
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
      ...(options.data === undefined ? {} : { data: serializeValue(options.data) }),
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
      ...(options.data === undefined ? {} : { data: serializeValue(options.data) }),
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

  const getTransactions = (
    id: string,
    query: DevtoolsTransactionQuery = {},
  ): DevtoolsTransactionPage => {
    const source = instances.get(id)?.transactions ?? [];
    const total = source.length;
    const requestedOffset = query.offset ?? 0;
    const offset = Number.isFinite(requestedOffset)
      ? Math.min(total, Math.max(0, Math.floor(requestedOffset)))
      : 0;
    const requestedLimit = query.limit;
    const limit =
      requestedLimit === undefined || requestedLimit === Number.POSITIVE_INFINITY
        ? total - offset
        : Number.isFinite(requestedLimit)
          ? Math.max(0, Math.floor(requestedLimit))
          : 0;
    const records =
      query.order === "newest-first"
        ? source.slice(Math.max(0, total - offset - limit), total - offset).reverse()
        : source.slice(offset, offset + limit);
    return {
      records,
      total,
      offset,
      hasMore: offset + records.length < total,
    };
  };

  return {
    getSnapshot() {
      materializePendingSnapshots();
      return snapshot;
    },
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
    getInstance(id) {
      if (dirtyInstanceSnapshots.delete(id)) {
        const entry = instances.get(id);
        if (entry) refreshInstanceSnapshot(entry);
      }
      return instances.get(id)?.snapshot;
    },
    subscribeInstance,
    getTransactions,
    getTransactionCount: (id) => instances.get(id)?.transactions.length ?? 0,
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
