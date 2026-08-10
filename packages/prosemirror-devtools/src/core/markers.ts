import { prosemirrorDevtoolsStore } from "./store/create-devtools-store";
import type { DevtoolsMarkerOptions, DevtoolsStore } from "./types";

export interface ProseMirrorDevtoolsMarkerOptions extends DevtoolsMarkerOptions {
  store?: DevtoolsStore;
}

/** Attach an instant marker to the currently active dispatch for an editor instance. */
export function markProseMirrorDevtools(
  instanceId: string,
  label: string,
  options: ProseMirrorDevtoolsMarkerOptions = {},
): boolean {
  const { store = prosemirrorDevtoolsStore, ...markerOptions } = options;
  return store.addMarker(instanceId, label, markerOptions);
}

/**
 * Measure synchronous application work and attach the span to the currently active dispatch.
 * The callback always runs, including when no dispatch is active.
 */
export function measureProseMirrorDevtools<T>(
  instanceId: string,
  label: string,
  run: () => T,
  options: ProseMirrorDevtoolsMarkerOptions = {},
): T {
  const { store = prosemirrorDevtoolsStore, ...markerOptions } = options;
  return store.measureMarker(instanceId, label, run, markerOptions);
}
