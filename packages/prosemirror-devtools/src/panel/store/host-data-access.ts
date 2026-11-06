import {
  createDevtoolsDataAccess,
  type DevtoolsDataAccess,
  type DevtoolsReadable,
} from "../../core/data-client";
import type { DevtoolsStore, RegisteredProseMirrorInstance } from "../../core/types";

function readable<T>(get: () => T, listeners: Set<() => void>): DevtoolsReadable<T> {
  return Object.assign(get, {
    get,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
}

export function createHostDataAccess(
  store: DevtoolsStore,
): DevtoolsDataAccess & { dispose(): void } {
  const shared = createDevtoolsDataAccess(store);
  const idListeners = new Set<() => void>();
  const instanceListeners = new Set<() => void>();
  let selectedId = store.getActiveInstanceId() ?? store.getInstanceDescriptors()[0]?.id ?? null;
  let unsubscribeInstance = (): void => {};
  const notifyInstance = (): void => {
    for (const listener of instanceListeners) listener();
  };
  const subscribeToInstance = (): void => {
    unsubscribeInstance();
    unsubscribeInstance =
      selectedId === null ? () => {} : shared.data.instance(selectedId).subscribe(notifyInstance);
  };
  const select = (id: string | null): void => {
    if (selectedId === id) return;
    selectedId = id;
    subscribeToInstance();
    for (const listener of idListeners) listener();
    notifyInstance();
  };
  subscribeToInstance();
  const unsubscribeDescriptors = shared.data.instanceDescriptors.subscribe(() => {
    if (selectedId === null || !store.getInstance(selectedId)) {
      select(store.getInstanceDescriptors()[0]?.id ?? null);
    }
  });
  const activeInstanceId = readable(() => selectedId, idListeners);
  const activeInstance = readable<RegisteredProseMirrorInstance | undefined>(
    () => (selectedId === null ? undefined : store.getInstance(selectedId)),
    instanceListeners,
  );

  return {
    data: { ...shared.data, activeInstanceId, activeInstance },
    actions: {
      ...shared.actions,
      setActiveInstance(id) {
        if (store.getInstance(id)) select(id);
      },
    },
    dispose() {
      unsubscribeInstance();
      unsubscribeDescriptors();
      idListeners.clear();
      instanceListeners.clear();
    },
  };
}
