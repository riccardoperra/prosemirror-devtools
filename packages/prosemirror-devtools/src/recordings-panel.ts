import { mountProseMirrorRecordingInspector as mountInEveryEnvironment } from "./production/recordings-panel";
import type {
  ProseMirrorRecordingInspectorMount,
  ProseMirrorRecordingInspectorMountOptions,
} from "./production/recordings-panel";

export * from "./production/recordings-panel";

/** Mounts the read-only recording viewer in development. Other environments return an inactive handle. */
export function mountProseMirrorRecordingInspector(
  element: HTMLElement,
  options: ProseMirrorRecordingInspectorMountOptions,
): ProseMirrorRecordingInspectorMount {
  if (process.env.NODE_ENV !== "development") return { update() {}, unmount() {} };
  return mountInEveryEnvironment(element, options);
}
