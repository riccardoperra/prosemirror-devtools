import type {
  DevtoolsDispatchListener,
  DevtoolsInstanceDescriptor,
  DevtoolsStore,
  RegisteredProseMirrorInstance,
} from "./types";

/**
 * A read-only live value exposed by the core store.
 *
 * Call the value directly or use {@link DevtoolsReadable.get | get} for the latest snapshot. Reads
 * are always immediate. Subscriptions run synchronously after core commits a logical operation
 * (for example, after the outermost nested dispatch completes), so consumers never need to flush
 * the store themselves. UI adapters may still defer rendering of that committed value when useful.
 */
export interface DevtoolsReadable<T> {
  /** Returns the current value. */
  (): T;
  /** Returns the current value. Equivalent to calling the readable. */
  get(): T;
  subscribe(listener: () => void): () => void;
}

export interface DevtoolsDataClient {
  readonly activeInstanceId: DevtoolsReadable<string | null>;
  /** Includes the live EditorView and therefore the complete current editor state. */
  readonly activeInstance: DevtoolsReadable<RegisteredProseMirrorInstance | undefined>;
  readonly instanceDescriptors: DevtoolsReadable<readonly DevtoolsInstanceDescriptor[]>;
  instance(id: string): DevtoolsReadable<RegisteredProseMirrorInstance | undefined>;
  subscribeDispatch(listener: DevtoolsDispatchListener): () => void;
}

export interface DevtoolsDataActions {
  setActiveInstance(id: string): void;
  clearTransactions(id: string): void;
}

export interface DevtoolsDataAccess {
  readonly data: DevtoolsDataClient;
  readonly actions: DevtoolsDataActions;
}

/** Exposes a live store value without leaking any write capability to panel integrations. */
function readable<T>(
  get: () => T,
  subscribe: (listener: () => void) => () => void,
): DevtoolsReadable<T> {
  const value = (() => get()) as DevtoolsReadable<T>;
  value.get = get;
  value.subscribe = subscribe;
  return value;
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

  const activeInstanceId = readable(store.getActiveInstanceId, store.subscribeActiveInstance);
  const instanceDescriptors = readable(
    store.getInstanceDescriptors,
    store.subscribeInstanceDescriptors,
  );
  const activeInstance = readable(
    () => {
      const id = store.getActiveInstanceId();
      return id === null ? undefined : store.getInstance(id);
    },
    (listener) => {
      let unsubscribeInstance = (): void => {};
      const subscribeToCurrentInstance = (): void => {
        unsubscribeInstance();
        const id = store.getActiveInstanceId();
        unsubscribeInstance = id === null ? () => {} : store.subscribeInstance(id, listener);
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
  );

  const instance = (id: string): DevtoolsReadable<RegisteredProseMirrorInstance | undefined> => {
    const existing = instanceReadables.get(id);
    if (existing) return existing;
    const value = readable(
      () => store.getInstance(id),
      (listener) => store.subscribeInstance(id, listener),
    );
    instanceReadables.set(id, value);
    return value;
  };

  const data: DevtoolsDataClient = {
    activeInstanceId,
    activeInstance,
    instanceDescriptors,
    instance,
    subscribeDispatch: store.subscribeDispatch,
  };
  const actions: DevtoolsDataActions = {
    setActiveInstance: store.setActiveInstance,
    clearTransactions: store.clearTransactions,
  };
  return { data, actions };
}
