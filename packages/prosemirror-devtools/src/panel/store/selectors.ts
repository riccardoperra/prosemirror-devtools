import { useSyncExternalStore } from "react";

import type { DevtoolsReadable } from "../../core/data-client";
import type { DevtoolsInstanceDescriptor, RegisteredProseMirrorInstance } from "../../core/types";
import { usePanelDataAccess } from "../panel-provider";

function useReadable<T>(readable: DevtoolsReadable<T>): T {
  return useSyncExternalStore(readable.subscribe, readable.getSnapshot, readable.getSnapshot);
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
