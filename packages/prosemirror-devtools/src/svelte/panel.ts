import { createSveltePanel } from "@tanstack/devtools-utils/svelte";
import type { Component } from "svelte";

import { ProseMirrorDevtoolsCore } from "../adapters/core";
import type {
  ProseMirrorDevtoolsAdapterPanelProps,
  TanStackDevtoolsTheme,
} from "../adapters/types";

export interface ProseMirrorDevtoolsSvelteInit extends ProseMirrorDevtoolsAdapterPanelProps {}

export interface ProseMirrorDevtoolsSveltePanelProps {
  theme?: TanStackDevtoolsTheme;
  devtoolsProps?: ProseMirrorDevtoolsSvelteInit;
}

class ProseMirrorDevtoolsSvelteCore extends ProseMirrorDevtoolsCore {
  constructor(props: ProseMirrorDevtoolsSvelteInit = {}) {
    super(props);
  }

  override mount(element: HTMLElement, theme?: TanStackDevtoolsTheme | "system"): void {
    super.mount(element, theme === "system" ? undefined : theme);
  }
}

const [PanelBase] = createSveltePanel<ProseMirrorDevtoolsSvelteInit, ProseMirrorDevtoolsSvelteCore>(
  ProseMirrorDevtoolsSvelteCore,
);

export const ProseMirrorDevtoolsPanel = PanelBase as Component<ProseMirrorDevtoolsSveltePanelProps>;
