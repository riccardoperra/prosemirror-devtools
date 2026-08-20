import { from, type Accessor } from "solid-js";

import type { DevtoolsReadable } from "../../core/data-client";
import type { DevtoolsInstanceDescriptor, RegisteredProseMirrorInstance } from "../../core/types";
import { usePanelDataAccess } from "../panel-provider";

/**
 * Adapts a framework-neutral devtools readable to an owner-scoped Solid signal.
 * Solid disposes the store subscription with the component owner.
 */
export function fromDevtoolsReadable<T>(readable: DevtoolsReadable<T>): Accessor<T> {
  return from((setValue) => readable.subscribe(() => setValue(() => readable())), readable());
}

export function useActiveInstanceId(): Accessor<string | null> {
  const { data } = usePanelDataAccess();
  return fromDevtoolsReadable(data.activeInstanceId);
}

export function useInstanceDescriptors(): Accessor<readonly DevtoolsInstanceDescriptor[]> {
  const { data } = usePanelDataAccess();
  return fromDevtoolsReadable(data.instanceDescriptors);
}

export function useActiveInstance(): Accessor<RegisteredProseMirrorInstance | undefined> {
  const { data } = usePanelDataAccess();
  return fromDevtoolsReadable(data.activeInstance);
}
