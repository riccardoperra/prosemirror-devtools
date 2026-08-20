import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

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
 * The renderer is intentionally kept behind this class so the upcoming Solid
 * rewrite does not change any framework adapter.
 */
export class ProseMirrorDevtoolsCore {
  readonly #initialProps: ProseMirrorDevtoolsAdapterPanelProps;
  #root: Root | null = null;

  constructor(initialProps: ProseMirrorDevtoolsAdapterPanelProps = {}) {
    this.#initialProps = initialProps;
  }

  mount(element: HTMLElement, mountProps?: unknown): void {
    if (this.#root) throw new Error("ProseMirror Devtools is already mounted.");

    const panelProps = resolveProseMirrorDevtoolsPanelProps(
      element,
      this.#initialProps,
      normalizeMountProps(mountProps),
    );
    this.#root = createRoot(element);
    this.#root.render(panelProps ? createElement(ProseMirrorDevtoolsPanel, panelProps) : null);
  }

  unmount(): void {
    this.#root?.unmount();
    this.#root = null;
  }
}
