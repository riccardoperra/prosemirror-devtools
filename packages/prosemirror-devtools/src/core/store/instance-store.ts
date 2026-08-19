import type { EditorView } from "prosemirror-view";

import type {
  DevtoolsDispatchEvent,
  DevtoolsDispatchListener,
  DevtoolsInstanceDescriptor,
  DevtoolsSnapshot,
  RegisterProseMirrorInstanceOptions,
  RegisteredProseMirrorInstance,
  TransactionRecord,
} from "../types";
import { readPluginTimingSummaries, type PluginTimingAggregates } from "./plugin-timings";

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

export type InternalInstance = InternalInstanceState & {
  snapshot: RegisteredProseMirrorInstance;
};

type InternalRegistrationOptions = Omit<RegisterProseMirrorInstanceOptions, "sessionId"> & {
  sessionId: string;
};

export interface InstanceStore {
  getSnapshot(): DevtoolsSnapshot;
  subscribe(listener: Listener): () => void;
  getActiveInstanceId(): string | null;
  subscribeActiveInstance(listener: Listener): () => void;
  getInstanceDescriptors(): readonly DevtoolsInstanceDescriptor[];
  subscribeInstanceDescriptors(listener: Listener): () => void;
  getInstance(id: string): RegisteredProseMirrorInstance | undefined;
  subscribeInstance(id: string, listener: Listener): () => void;
  subscribeDispatch(listener: DevtoolsDispatchListener): () => void;
  getEntry(id: string): InternalInstance | undefined;
  register(options: InternalRegistrationOptions, pluginTimings: PluginTimingAggregates): () => void;
  unregister(id: string, view?: EditorView): void;
  setActiveInstance(id: string): void;
  clearTransactions(id: string): void;
  recordTransaction(
    entry: InternalInstance,
    record: TransactionRecord,
    dispatch: { sequence: number; event: DevtoolsDispatchEvent },
  ): void;
  markChanged(entry: InternalInstance): void;
  flush(): void;
}

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

function createSnapshot(entry: InternalInstanceState): RegisteredProseMirrorInstance {
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

export function createInstanceStore({
  clearRecords,
  onRemove,
}: {
  clearRecords(records: readonly TransactionRecord[]): void;
  onRemove(instanceId: string): void;
}): InstanceStore {
  const instances = new Map<string, InternalInstance>();
  const listeners = new Set<Listener>();
  const activeInstanceListeners = new Set<Listener>();
  const descriptorListeners = new Set<Listener>();
  const instanceListeners = new Map<string, Set<Listener>>();
  const dispatchListeners = new Set<DevtoolsDispatchListener>();

  let activeInstanceId: string | null = null;
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
    snapshot = {
      activeInstanceId,
      instances: Array.from(instances.values(), (entry) => entry.snapshot),
      version: ++version,
    };
  };

  const refresh = (entry: InternalInstance): void => {
    entry.snapshot = createSnapshot(entry);
  };

  // Recording updates refresh snapshots immediately but batch subscriber calls.
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

  const queueRecordedUpdate = (
    entry: InternalInstance,
    dispatch?: { sequence: number; event: DevtoolsDispatchEvent },
  ): void => {
    refresh(entry);
    rebuildSnapshot();
    changedInstanceIds.add(entry.id);
    if (dispatch) queuedDispatches.push(dispatch);
    if (notificationScheduled) return;
    notificationScheduled = true;
    queueMicrotask(flush);
  };

  // Registration and selection changes are rare, so publish them synchronously.
  const publishNow = ({
    instanceId,
    descriptorsChanged = false,
    activeInstanceChanged = false,
  }: {
    instanceId?: string;
    descriptorsChanged?: boolean;
    activeInstanceChanged?: boolean;
  } = {}): void => {
    if (descriptorsChanged) {
      descriptors = Array.from(instances.values(), ({ id, label }) => ({ id, label }));
    }
    rebuildSnapshot();
    notify(listeners);
    if (descriptorsChanged) notify(descriptorListeners);
    if (activeInstanceChanged) notify(activeInstanceListeners);
    if (instanceId !== undefined) {
      const subscriptions = instanceListeners.get(instanceId);
      if (subscriptions) notify(subscriptions);
    }
  };

  const remove = (id: string, view?: EditorView): void => {
    const entry = instances.get(id);
    if (!entry || (view && entry.view !== view)) return;
    clearRecords(entry.transactions);
    instances.delete(id);
    onRemove(id);
    const activeInstanceChanged = activeInstanceId === id;
    if (activeInstanceChanged) activeInstanceId = instances.keys().next().value ?? null;
    publishNow({ instanceId: id, descriptorsChanged: true, activeInstanceChanged });
  };

  const release = (id: string, view: EditorView): void => {
    flush();
    const entry = instances.get(id);
    if (!entry || entry.view !== view) return;
    entry.registrationCount -= 1;
    if (entry.registrationCount <= 0) remove(id, view);
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
    subscribeInstance(id, listener) {
      const subscriptions = instanceListeners.get(id) ?? new Set();
      subscriptions.add(listener);
      instanceListeners.set(id, subscriptions);
      return () => {
        subscriptions.delete(listener);
        if (subscriptions.size === 0) instanceListeners.delete(id);
      };
    },
    subscribeDispatch(listener) {
      dispatchListeners.add(listener);
      return () => dispatchListeners.delete(listener);
    },
    getEntry: (id) => instances.get(id),
    register(options, pluginTimings) {
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
        if (options.sessionId !== existing.sessionId) {
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
        refresh(entry);
      } else {
        const initial = {
          id: options.id,
          sessionId: options.sessionId,
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
        entry = { ...initial, snapshot: createSnapshot(initial) };
        instances.set(options.id, entry);
      }

      const activeInstanceChanged = activeInstanceId === null;
      activeInstanceId ??= options.id;
      publishNow({ instanceId: options.id, descriptorsChanged, activeInstanceChanged });

      let active = true;
      return () => {
        if (!active) return;
        active = false;
        release(options.id, options.view);
      };
    },
    unregister(id, view) {
      flush();
      remove(id, view);
    },
    setActiveInstance(id) {
      flush();
      if (!instances.has(id)) {
        throw new Error(`Cannot activate unknown ProseMirror editor "${id}".`);
      }
      if (activeInstanceId === id) return;
      activeInstanceId = id;
      publishNow({ activeInstanceChanged: true });
    },
    clearTransactions(id) {
      flush();
      const entry = instances.get(id);
      if (!entry) return;
      clearRecords(entry.transactions);
      entry.transactions = [];
      entry.pluginTimings.clear();
      entry.updatedAt = Date.now();
      refresh(entry);
      publishNow({ instanceId: id });
    },
    recordTransaction(entry, record, dispatch) {
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
      queueRecordedUpdate(entry, dispatch);
    },
    markChanged(entry) {
      entry.updatedAt = Date.now();
      queueRecordedUpdate(entry);
    },
    flush,
  };
}
