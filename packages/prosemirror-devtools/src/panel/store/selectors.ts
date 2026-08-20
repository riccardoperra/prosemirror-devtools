import { from, type Accessor } from "solid-js";

import type { DevtoolsReadable } from "../../core/data-client";
import type { DevtoolsInstanceDescriptor, RegisteredProseMirrorInstance } from "../../core/types";
import { usePanelDataAccess } from "../panel-provider";

function useReadable<T>(readable: DevtoolsReadable<T>): Accessor<T> {
  return from((setValue) => readable.subscribe(() => setValue(() => readable())), readable());
}

export function useActiveInstanceId(): Accessor<string | null> {
  const { data } = usePanelDataAccess();
  return useReadable(data.activeInstanceId);
}

export function useInstanceDescriptors(): Accessor<readonly DevtoolsInstanceDescriptor[]> {
  const { data } = usePanelDataAccess();
  return useReadable(data.instanceDescriptors);
}

export function useActiveInstance(): Accessor<RegisteredProseMirrorInstance | undefined> {
  const { data } = usePanelDataAccess();
  return useReadable(data.activeInstance);
}
