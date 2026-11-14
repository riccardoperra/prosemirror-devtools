import { createComponent, createSignal, mergeProps } from "solid-js";

import { ProseMirrorDevtoolsCore } from "../adapters/core";
import { RecordingInspector, type RecordingInspectorProps } from "../panel/recording-inspector";

export { RecordingInspector } from "../panel/recording-inspector";
export type { RecordingInspectorProps } from "../panel/recording-inspector";

export type ProseMirrorRecordingInspectorMountOptions = Omit<
  RecordingInspectorProps,
  "styleTarget"
>;
export interface ProseMirrorRecordingInspectorMount {
  update(options: ProseMirrorRecordingInspectorMountOptions): void;
  unmount(): void;
}

/** Mounts the read-only recording viewer in every environment, production builds included. */
export function mountProseMirrorRecordingInspector(
  element: HTMLElement,
  options: ProseMirrorRecordingInspectorMountOptions,
): ProseMirrorRecordingInspectorMount {
  const renderer = new ProseMirrorDevtoolsCore();
  const [current, setCurrent] = createSignal(options);
  let mounted = true;
  renderer.mountView(element, () =>
    createComponent(
      RecordingInspector,
      mergeProps(current, { styleTarget: element.ownerDocument }),
    ),
  );
  return {
    update(next) {
      if (!mounted) throw new Error("ProseMirror recording inspector is not mounted.");
      setCurrent(() => next);
    },
    unmount() {
      mounted = false;
      renderer.unmount();
    },
  };
}
