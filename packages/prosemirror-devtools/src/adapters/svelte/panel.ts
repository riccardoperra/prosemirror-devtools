import { createSveltePanel } from "@tanstack/devtools-utils/svelte";
import { onDestroy, type Component } from "svelte";

import { ProseMirrorDevtoolsCore } from "../core";
import type { ProseMirrorDevtoolsAdapterPanelProps, TanStackDevtoolsTheme } from "../types";

export interface ProseMirrorDevtoolsSvelteInit extends ProseMirrorDevtoolsAdapterPanelProps {}

export interface ProseMirrorDevtoolsSveltePanelProps {
  theme?: TanStackDevtoolsTheme;
  devtoolsProps?: ProseMirrorDevtoolsSvelteInit;
}

class ProseMirrorDevtoolsSvelteCore extends ProseMirrorDevtoolsCore {
  #element: HTMLElement | null = null;

  constructor(props: ProseMirrorDevtoolsSvelteInit = {}) {
    super(props);
    // The TanStack wrapper returns a legacy destroy method. Svelte 5 unmounts
    // components through lifecycle hooks rather than invoking that method.
    onDestroy(() => this.unmount());
  }

  override mount(element: HTMLElement, theme?: TanStackDevtoolsTheme | "system"): void {
    super.mount(element, theme === "system" ? undefined : theme);
    this.#element = element;
  }

  override unmount(): void {
    super.unmount();
    this.#element?.remove();
    this.#element = null;
  }
}

const [PanelBase] = createSveltePanel<ProseMirrorDevtoolsSvelteInit, ProseMirrorDevtoolsSvelteCore>(
  ProseMirrorDevtoolsSvelteCore,
);

export const ProseMirrorDevtoolsPanel = PanelBase as Component<ProseMirrorDevtoolsSveltePanelProps>;
