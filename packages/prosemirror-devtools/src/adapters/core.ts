import { createComponent } from "solid-js";
import { render } from "solid-js/web";

import { ProseMirrorDevtoolsPanel } from "../panel/panel";
import { resolveProseMirrorDevtoolsPanelProps } from "./panel-props";
import type { ProseMirrorDevtoolsAdapterPanelProps } from "./types";

function normalizeMountProps(props: unknown): ProseMirrorDevtoolsAdapterPanelProps | undefined {
  if (typeof props === "string") {
    if (props === "light" || props === "dark") return { theme: props };
    return undefined;
  }
  if (!props || typeof props !== "object") return undefined;
  return props as ProseMirrorDevtoolsAdapterPanelProps;
}

/**
 * Framework-independent mount contract consumed by `@tanstack/devtools-utils`.
 *
 * The Solid renderer stays behind this class so every framework adapter shares
 * the same imperative mount contract.
 */
export class ProseMirrorDevtoolsCore {
  readonly #initialProps: ProseMirrorDevtoolsAdapterPanelProps;
  #dispose: (() => void) | null = null;

  constructor(initialProps: ProseMirrorDevtoolsAdapterPanelProps = {}) {
    this.#initialProps = initialProps;
  }

  mount(element: HTMLElement, mountProps?: unknown): void {
    if (this.#dispose) throw new Error("ProseMirror Devtools is already mounted.");

    const panelProps = resolveProseMirrorDevtoolsPanelProps(
      element,
      this.#initialProps,
      normalizeMountProps(mountProps),
    );
    this.#dispose = render(
      () => (panelProps ? createComponent(ProseMirrorDevtoolsPanel, panelProps) : null),
      element,
    );
  }

  unmount(): void {
    this.#dispose?.();
    this.#dispose = null;
  }
}
