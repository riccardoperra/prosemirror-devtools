import type { EditorState, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

import { serializeValue } from "../serialize";
import type {
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

const DEFAULT_TRANSACTION_LIMIT = 10_000;

type InternalInstanceState = {
  id: string;
  label: string;
  view: EditorView;
  registeredAt: number;
  updatedAt: number;
  dispatchCount: number;
  transactionLimit: number;
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

/**
 * Creates an isolated devtools store. Runtime state stays private to this
 * closure; integrations depend only on the small capabilities in DevtoolsStore.
 */
export function createProseMirrorDevtoolsStore(): DevtoolsStore {
  const instances = new Map<string, InternalInstance>();
  const pendingPluginTimings = new Map<string, PluginTimingAggregates>();
  const frames = new Map<string, InternalTransactionMeasurement[]>();
  const listeners = new Set<Listener>();
  const activeInstanceListeners = new Set<Listener>();
  const descriptorListeners = new Set<Listener>();
  const instanceListeners = new Map<string, Set<Listener>>();
  const performanceEntries = createPerformanceEntryStore();

  let activeInstanceId: string | null = null;
  let version = 0;
  let snapshot: DevtoolsSnapshot = EMPTY_SNAPSHOT;
  let descriptors: readonly DevtoolsInstanceDescriptor[] = [];

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
    const subscriptions = instanceId ? instanceListeners.get(instanceId) : undefined;
    if (subscriptions) notify(subscriptions);
  };

  const refreshInstanceSnapshot = (entry: InternalInstance): void => {
    entry.snapshot = createInstanceSnapshot(entry);
  };

  const clearRecords = (records: readonly TransactionRecord[]): void => {
    for (const record of records) performanceEntries.clear(record);
  };

  const register = (options: RegisterProseMirrorInstanceOptions): (() => void) => {
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
      const nextLabel = options.label ?? existing.label;
      descriptorsChanged = nextLabel !== existing.label;
      existing.label = nextLabel;
      existing.transactionLimit = Math.max(
        1,
        options.transactionLimit ?? existing.transactionLimit,
      );
      if (existing.transactions.length > existing.transactionLimit) {
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
      const pluginTimings = pendingPluginTimings.get(options.id) ?? new Map();
      const initial: InternalInstanceState = {
        id: options.id,
        label: options.label ?? options.id,
        view: options.view,
        registeredAt,
        updatedAt: registeredAt,
        dispatchCount: 0,
        transactionLimit: Math.max(1, options.transactionLimit ?? DEFAULT_TRANSACTION_LIMIT),
        transactions: [],
        pluginTimings,
      };
      entry = {
        ...initial,
        snapshot: createInstanceSnapshot(initial),
      };
      instances.set(options.id, entry);
      pendingPluginTimings.delete(options.id);
    }
    refreshInstanceSnapshot(entry);

    const activeInstanceChanged = activeInstanceId === null;
    activeInstanceId ??= options.id;
    publish({ instanceId: options.id, descriptorsChanged, activeInstanceChanged });

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      unregister(options.id, options.view);
    };
  };

  const unregister = (id: string, view?: EditorView): void => {
    const current = instances.get(id);
    if (!current || (view && current.view !== view)) return;
    clearRecords(current.transactions);
    instances.delete(id);
    frames.delete(id);
    const activeInstanceChanged = activeInstanceId === id;
    if (activeInstanceChanged) activeInstanceId = instances.keys().next().value ?? null;
    publish({ instanceId: id, descriptorsChanged: true, activeInstanceChanged });
  };

  const setActiveInstance = (id: string): void => {
    if (!instances.has(id)) {
      throw new Error(`Cannot activate unknown ProseMirror editor "${id}".`);
    }
    if (activeInstanceId === id) return;
    activeInstanceId = id;
    publish({ activeInstanceChanged: true });
  };

  const clearTransactions = (id: string): void => {
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
  ): TransactionMeasurement => {
    const entry = instances.get(instanceId);
    const measurement = createTransactionMeasurement({
      instanceId,
      id: entry ? ++entry.dispatchCount : 0,
      instanceLabel: entry?.label ?? instanceId,
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
    if (!entry) return null;

    const record = createTransactionRecord({
      id: internal.id,
      instanceId: internal.instanceId,
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

    const nextRecords = [...entry.transactions, record];
    const overflow = Math.max(0, nextRecords.length - entry.transactionLimit);
    if (overflow > 0) clearRecords(nextRecords.slice(0, overflow));
    entry.transactions = overflow > 0 ? nextRecords.slice(overflow) : nextRecords;
    entry.updatedAt = Date.now();
    refreshInstanceSnapshot(entry);
    publish({ instanceId: entry.id });
    return record;
  };

  const measurePluginHook = <T>(
    instanceId: string,
    pluginKey: string,
    pluginLabel: string,
    hook: PluginHook,
    run: () => T,
  ): T => {
    const startedAt = monotonicNow();
    try {
      return run();
    } finally {
      const duration = Math.max(0, monotonicNow() - startedAt);
      const entry = instances.get(instanceId);
      const aggregates = entry?.pluginTimings ?? pendingPluginTimings.get(instanceId) ?? new Map();
      if (!entry && !pendingPluginTimings.has(instanceId)) {
        pendingPluginTimings.set(instanceId, aggregates);
      }
      recordPluginTiming(aggregates, pluginKey, pluginLabel, hook, duration);

      const frame = frames.get(instanceId)?.at(-1);
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
        refreshInstanceSnapshot(entry);
        publish({ instanceId });
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
    register,
    unregister,
    setActiveInstance,
    clearTransactions,
    beginTransaction,
    recordPhase,
    finishTransaction,
    measurePluginHook,
    addMarker,
    measureMarker,
  };
}

export const prosemirrorDevtoolsStore = createProseMirrorDevtoolsStore();
