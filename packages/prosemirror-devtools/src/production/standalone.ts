import { createSignal } from "solid-js";

import { ProseMirrorDevtoolsCore } from "../adapters/core";
import type { ProseMirrorDevtoolsPanelProps } from "../panel/panel.types";

export type ProseMirrorDevtoolsMountOptions = Omit<
  ProseMirrorDevtoolsPanelProps,
  "embedded" | "styleTarget"
>;

export interface ProseMirrorDevtoolsMount {
  update(options: ProseMirrorDevtoolsMountOptions): void;
  unmount(): void;
}

/** Mounts the shared panel in every environment, production builds included. */
export function mountProseMirrorDevtools(
  element: HTMLElement,
  options: ProseMirrorDevtoolsMountOptions = {},
): ProseMirrorDevtoolsMount {
  const renderer = new ProseMirrorDevtoolsCore();
  const [current, setCurrent] = createSignal(options);
  let mounted = true;
  renderer.mountWithProps(element, () => ({
    ...current(),
    embedded: false,
    styleTarget: element.ownerDocument,
  }));

  return {
    update(nextOptions) {
      if (!mounted) throw new Error("ProseMirror Inspector is not mounted.");
      setCurrent(() => nextOptions);
    },
    unmount() {
      mounted = false;
      renderer.unmount();
    },
  };
}
