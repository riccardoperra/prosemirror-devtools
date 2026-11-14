import { mountProseMirrorDevtools as mountInEveryEnvironment } from "./production/standalone";
import type {
  ProseMirrorDevtoolsMount,
  ProseMirrorDevtoolsMountOptions,
} from "./production/standalone";

export * from "./production/standalone";

/** Mounts the shared panel in development. Other environments return an inactive handle. */
export function mountProseMirrorDevtools(
  element: HTMLElement,
  options: ProseMirrorDevtoolsMountOptions = {},
): ProseMirrorDevtoolsMount {
  if (process.env.NODE_ENV !== "development") return { update() {}, unmount() {} };
  return mountInEveryEnvironment(element, options);
}
