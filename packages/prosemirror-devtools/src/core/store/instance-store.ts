import type { EditorView } from "prosemirror-view";
import type { DevtoolsDiagnosticsController } from "../diagnostics";

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
import { createSignalScheduler, createStoreSignal, type StoreSignal } from "./signal";

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
  diagnostics?: DevtoolsDiagnosticsController;
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
  /**
   * Starts a synchronous notification batch for a recorded dispatch. Paired calls may nest because
   * a ProseMirror dispatch can trigger another dispatch before it returns.
   */
  beginBatch(): void;
  /**
   * Finishes a recorded-dispatch batch. Only the outermost call publishes subscribers, ensuring
   * they observe a complete dispatch tree rather than intermediate recording phases.
   */
  endBatch(): void;
}

const EMPTY_SNAPSHOT: DevtoolsSnapshot = {
  activeInstanceId: null,
  instances: [],
  version: 0,
};

function notifyDispatch(
  listeners: ReadonlySet<DevtoolsDispatchListener>,
  events: readonly DevtoolsDispatchEvent[],
): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener(events);
    } catch (error) {
      console.error("[prosemirror-inspector] Dispatch subscriber failed", error);
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
    ...(entry.diagnostics ? { diagnostics: entry.diagnostics } : {}),
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
  // Signals update their values immediately. Their shared scheduler controls only when observers
  // hear about related writes, allowing one logical operation to publish atomically.
  const scheduler = createSignalScheduler();
  const snapshot = createStoreSignal<DevtoolsSnapshot>(EMPTY_SNAPSHOT, scheduler);
  const activeInstance = createStoreSignal<string | null>(null, scheduler);
  const descriptors = createStoreSignal<readonly DevtoolsInstanceDescriptor[]>([], scheduler);
  const instanceSignals = new Map<string, StoreSignal<RegisteredProseMirrorInstance | undefined>>();
  const dispatchListeners = new Set<DevtoolsDispatchListener>();

  let activeInstanceId: string | null = null;
  let version = 0;
  // Nested dispatches complete inside-out, which is not their invocation order. Keep their capture
  // sequence until the outermost batch can publish the complete group.
  const queuedDispatches: Array<{
    sequence: number;
    event: DevtoolsDispatchEvent;
  }> = [];

  // A stable signal per id lets subscribers remain attached while that instance is removed and
  // later registered again.
  const instanceSignal = (id: string): StoreSignal<RegisteredProseMirrorInstance | undefined> => {
    const existing = instanceSignals.get(id);
    if (existing) return existing;
    const signal = createStoreSignal(instances.get(id)?.snapshot, scheduler);
    instanceSignals.set(id, signal);
    return signal;
  };

  const rebuildSnapshot = (): void => {
    snapshot.set({
      activeInstanceId,
      instances: Array.from(instances.values(), (entry) => entry.snapshot),
      version: ++version,
    });
  };

  const refresh = (entry: InternalInstance): void => {
    entry.snapshot = createSnapshot(entry);
  };

  /** Publishes committed dispatches in invocation order, including nested dispatches. */
  const publishDispatches = (): void => {
    const dispatches = queuedDispatches.splice(0).sort((left, right) => {
      return left.sequence - right.sequence;
    });
    if (dispatches.length > 0 && dispatchListeners.size > 0) {
      notifyDispatch(
        dispatchListeners,
        dispatches.map(({ event }) => event),
      );
    }
  };

  // Recording code may need the latest value before dispatch returns, so writes stay immediate.
  // Subscriber delivery waits so plugin timing, transaction data, and final view state appear as
  // one coherent update after the outermost nested dispatch finishes.
  const publishRecordedUpdate = (
    entry: InternalInstance,
    dispatch?: { sequence: number; event: DevtoolsDispatchEvent },
  ): void => {
    refresh(entry);
    rebuildSnapshot();
    instanceSignal(entry.id).set(entry.snapshot);
    if (dispatch) {
      queuedDispatches.push(dispatch);
      scheduler.schedule(publishDispatches);
    }
  };

  // These mutations do not belong to transaction recording, but each can change several related
  // signals. A short batch prevents combinations such as new descriptors with the previous active
  // instance from becoming externally observable.
  const publishNow = ({
    instanceId,
    descriptorsChanged = false,
    activeInstanceChanged = false,
  }: {
    instanceId?: string;
    descriptorsChanged?: boolean;
    activeInstanceChanged?: boolean;
  } = {}): void => {
    scheduler.batch(() => {
      if (descriptorsChanged) {
        descriptors.set(Array.from(instances.values(), ({ id, label }) => ({ id, label })));
      }
      if (activeInstanceChanged) activeInstance.set(activeInstanceId);
      rebuildSnapshot();
      if (instanceId !== undefined) {
        instanceSignal(instanceId).set(instances.get(instanceId)?.snapshot);
      }
    });
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

  const release = (entry: InternalInstance): void => {
    // A forced unregister can be followed by a new registration of the very same view. An older
    // lease belongs to its original entry, and must not tear down that replacement registration.
    if (instances.get(entry.id) !== entry) return;
    entry.registrationCount -= 1;
    if (entry.registrationCount <= 0) remove(entry.id, entry.view);
  };

  return {
    getSnapshot: snapshot.get,
    subscribe: snapshot.subscribe,
    getActiveInstanceId: activeInstance.get,
    subscribeActiveInstance: activeInstance.subscribe,
    getInstanceDescriptors: descriptors.get,
    subscribeInstanceDescriptors: descriptors.subscribe,
    getInstance: (id) => instances.get(id)?.snapshot,
    subscribeInstance: (id, listener) => instanceSignal(id).subscribe(listener),
    subscribeDispatch(listener) {
      dispatchListeners.add(listener);
      return () => dispatchListeners.delete(listener);
    },
    getEntry: (id) => instances.get(id),
    register(options, pluginTimings) {
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
        if (options.diagnostics) existing.diagnostics = options.diagnostics;
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
          ...(options.diagnostics ? { diagnostics: options.diagnostics } : {}),
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
        release(entry);
      };
    },
    unregister(id, view) {
      remove(id, view);
    },
    setActiveInstance(id) {
      if (!instances.has(id)) {
        throw new Error(`Cannot activate unknown ProseMirror editor "${id}".`);
      }
      if (activeInstanceId === id) return;
      activeInstanceId = id;
      publishNow({ activeInstanceChanged: true });
    },
    clearTransactions(id) {
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
      const latest = transactions.at(-1);
      if (!latest || latest.id < record.id) {
        transactions.push(record);
      } else {
        // Normal dispatches append in constant search time. Nested dispatches finish inside-out,
        // so locate their insertion point without rescanning the complete retained history.
        let low = 0;
        let high = transactions.length;
        while (low < high) {
          const middle = (low + high) >>> 1;
          if (transactions[middle]!.id <= record.id) low = middle + 1;
          else high = middle;
        }
        transactions.splice(low, 0, record);
      }

      const overflow =
        entry.transactionLimit === null
          ? 0
          : Math.max(0, transactions.length - entry.transactionLimit);
      if (overflow > 0) clearRecords(transactions.splice(0, overflow));
      entry.transactions = transactions;
      entry.updatedAt = Date.now();
      publishRecordedUpdate(entry, dispatch);
    },
    markChanged(entry) {
      entry.updatedAt = Date.now();
      publishRecordedUpdate(entry);
    },
    beginBatch: scheduler.begin,
    endBatch: scheduler.end,
  };
}
