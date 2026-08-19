import type {
  DevtoolsDispatchListener,
  DevtoolsInstanceDescriptor,
  DevtoolsStore,
  RegisteredProseMirrorInstance,
} from "./types";

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
      return id === null ? undefined : store.getInstance(id);
    },
    subscribe(listener) {
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
    flush: store.flush,
  };
  return { data, actions };
}
