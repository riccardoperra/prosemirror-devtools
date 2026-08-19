import { useSyncExternalStore } from "react";

import type { DevtoolsReadable } from "../../core/data-client";
import type { DevtoolsInstanceDescriptor, RegisteredProseMirrorInstance } from "../../core/types";
import { usePanelDataAccess } from "../panel-provider";

function useReadable<T>(readable: DevtoolsReadable<T>): T {
  // Core already makes related writes atomic. This hook only bridges the committed external value
  // into React; an expensive view may apply useDeferredValue to the returned value independently.
  return useSyncExternalStore(readable.subscribe, readable, readable);
}

export function useActiveInstanceId(): string | null {
  const { data } = usePanelDataAccess();
  return useReadable(data.activeInstanceId);
}

export function useInstanceDescriptors(): readonly DevtoolsInstanceDescriptor[] {
  const { data } = usePanelDataAccess();
  return useReadable(data.instanceDescriptors);
}

export function useActiveInstance(): RegisteredProseMirrorInstance | undefined {
  const { data } = usePanelDataAccess();
  return useReadable(data.activeInstance);
}
