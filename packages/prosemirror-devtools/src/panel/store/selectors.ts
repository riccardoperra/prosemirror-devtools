import { useCallback, useSyncExternalStore } from "react";

import type { DevtoolsInstanceDescriptor, RegisteredProseMirrorInstance } from "../../core/types";
import { usePanelStore } from "../panel-provider";

export function useActiveInstanceId(): string | null {
  const store = usePanelStore();
  return useSyncExternalStore(
    store.subscribeActiveInstance,
    store.getActiveInstanceId,
    store.getActiveInstanceId,
  );
}

export function useInstanceDescriptors(): readonly DevtoolsInstanceDescriptor[] {
  const store = usePanelStore();
  return useSyncExternalStore(
    store.subscribeInstanceDescriptors,
    store.getInstanceDescriptors,
    store.getInstanceDescriptors,
  );
}

export function useInstance(id: string | null): RegisteredProseMirrorInstance | undefined {
  const store = usePanelStore();
  const subscribe = useCallback(
    (listener: () => void) => (id === null ? () => {} : store.subscribeInstance(id, listener)),
    [store, id],
  );
  const getSnapshot = useCallback(
    () => (id === null ? undefined : store.getInstance(id)),
    [store, id],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useActiveInstance(): RegisteredProseMirrorInstance | undefined {
  return useInstance(useActiveInstanceId());
}
