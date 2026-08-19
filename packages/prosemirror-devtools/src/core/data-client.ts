import type {
  DevtoolsDispatchListener,
  DevtoolsInstanceDescriptor,
  DevtoolsStore,
  DevtoolsTransactionPage,
  DevtoolsTransactionQuery,
  RegisteredProseMirrorInstance,
} from "./types";
import { normalizeTransactionQuery } from "./transaction-query";

export interface DevtoolsReadable<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

export interface DevtoolsDataClient {
  readonly activeInstanceId: DevtoolsReadable<string | null>;
  /** Includes the live EditorView and therefore the complete current editor state. */
  readonly activeInstance: DevtoolsReadable<RegisteredProseMirrorInstance | undefined>;
  readonly instanceDescriptors: DevtoolsReadable<readonly DevtoolsInstanceDescriptor[]>;
  instance(id: string): DevtoolsReadable<RegisteredProseMirrorInstance | undefined>;
  transactions(
    id: string,
    query?: DevtoolsTransactionQuery,
  ): DevtoolsReadable<DevtoolsTransactionPage>;
  selectInstance<T>(
    id: string,
    selector: (instance: RegisteredProseMirrorInstance | undefined) => T,
    isEqual?: (left: T, right: T) => boolean,
  ): DevtoolsReadable<T>;
  subscribeDispatch(listener: DevtoolsDispatchListener): () => void;
}

export interface DevtoolsDataActions {
  setActiveInstance(id: string): void;
  clearTransactions(id: string): void;
  flush(): void;
}

export interface DevtoolsDataAccess {
  readonly data: DevtoolsDataClient;
  readonly actions: DevtoolsDataActions;
}

function selectedReadable<TSource, TSelected>(
  source: DevtoolsReadable<TSource>,
  selector: (source: TSource) => TSelected,
  isEqual: (left: TSelected, right: TSelected) => boolean = Object.is,
): DevtoolsReadable<TSelected> {
  let sourceSnapshot = source.getSnapshot();
  let selected = selector(sourceSnapshot);
  const read = (): TSelected => {
    const nextSource = source.getSnapshot();
    if (!Object.is(nextSource, sourceSnapshot)) {
      sourceSnapshot = nextSource;
      const nextSelected = selector(nextSource);
      if (!isEqual(selected, nextSelected)) selected = nextSelected;
    }
    return selected;
  };
  return {
    getSnapshot: read,
    subscribe(listener) {
      return source.subscribe(() => {
        const previous = selected;
        const next = read();
        if (!isEqual(previous, next)) listener();
      });
    },
  };
}

function sameTransactionPage(
  left: DevtoolsTransactionPage,
  right: DevtoolsTransactionPage,
): boolean {
  return (
    left.total === right.total &&
    left.offset === right.offset &&
    left.hasMore === right.hasMore &&
    left.records.length === right.records.length &&
    left.records.every((record, index) => record === right.records[index])
  );
}

/**
 * Creates the intentionally small, framework-neutral data surface handed to
 * panel extensions. It exposes live EditorView/state through `instance()` but
 * does not expose recorder mutation methods.
 */
export function createDevtoolsDataAccess(store: DevtoolsStore): DevtoolsDataAccess {
  const instanceReadables = new Map<
    string,
    DevtoolsReadable<RegisteredProseMirrorInstance | undefined>
  >();
  const transactionReadables = new Map<string, DevtoolsReadable<DevtoolsTransactionPage>>();

  const activeInstanceId: DevtoolsReadable<string | null> = {
    getSnapshot: store.getActiveInstanceId,
    subscribe: store.subscribeActiveInstance,
  };
  const instanceDescriptors: DevtoolsReadable<readonly DevtoolsInstanceDescriptor[]> = {
    getSnapshot: store.getInstanceDescriptors,
    subscribe: store.subscribeInstanceDescriptors,
  };
  const activeInstance: DevtoolsReadable<RegisteredProseMirrorInstance | undefined> = {
    getSnapshot: () => {
      const id = store.getActiveInstanceId();
      return id ? store.getInstance(id) : undefined;
    },
    subscribe(listener) {
      let unsubscribeInstance = (): void => {};
      const subscribeToCurrentInstance = (): void => {
        unsubscribeInstance();
        const id = store.getActiveInstanceId();
        unsubscribeInstance = id ? store.subscribeInstance(id, listener) : () => {};
      };
      subscribeToCurrentInstance();
      const unsubscribeActive = store.subscribeActiveInstance(() => {
        subscribeToCurrentInstance();
        listener();
      });
      return () => {
        unsubscribeActive();
        unsubscribeInstance();
      };
    },
  };

  const instance = (id: string): DevtoolsReadable<RegisteredProseMirrorInstance | undefined> => {
    const existing = instanceReadables.get(id);
    if (existing) return existing;
    const readable: DevtoolsReadable<RegisteredProseMirrorInstance | undefined> = {
      getSnapshot: () => store.getInstance(id),
      subscribe: (listener) => store.subscribeInstance(id, listener),
    };
    instanceReadables.set(id, readable);
    return readable;
  };

  const transactions = (
    id: string,
    query: DevtoolsTransactionQuery = {},
  ): DevtoolsReadable<DevtoolsTransactionPage> => {
    const normalizedQuery = normalizeTransactionQuery(query);
    // Reuse readables so external-store snapshots stay stable across equivalent calls.
    const key = JSON.stringify([
      id,
      normalizedQuery.offset,
      normalizedQuery.limit ?? null,
      normalizedQuery.order,
    ]);
    const existing = transactionReadables.get(key);
    if (existing) return existing;
    const readable = selectedReadable(
      instance(id),
      () => store.getTransactions(id, normalizedQuery),
      sameTransactionPage,
    );
    transactionReadables.set(key, readable);
    return readable;
  };

  const data: DevtoolsDataClient = {
    activeInstanceId,
    activeInstance,
    instanceDescriptors,
    instance,
    transactions,
    selectInstance(id, selector, isEqual) {
      return selectedReadable(instance(id), selector, isEqual);
    },
    subscribeDispatch: store.subscribeDispatch,
  };
  const actions: DevtoolsDataActions = {
    setActiveInstance: store.setActiveInstance,
    clearTransactions: store.clearTransactions,
    flush: store.flush,
  };
  return { data, actions };
}
