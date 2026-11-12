import { createSveltePanel, type DevtoolsPanelProps } from "@tanstack/devtools-utils/svelte";
import type { Component } from "svelte";

import { ProseMirrorDevtoolsCore } from "../core";
import { resolveProseMirrorDevtoolsAdapterPanelProps } from "../panel-props";
import type { ProseMirrorDevtoolsAdapterPanelProps, TanStackDevtoolsTheme } from "../types";

export interface ProseMirrorDevtoolsSvelteInit extends ProseMirrorDevtoolsAdapterPanelProps {}

export interface ProseMirrorDevtoolsSveltePanelProps {
  theme?: TanStackDevtoolsTheme;
  devtoolsProps?: ProseMirrorDevtoolsSvelteInit;
}

type SvelteHostPanelProps = DevtoolsPanelProps & ProseMirrorDevtoolsSveltePanelProps;

class ProseMirrorDevtoolsSvelteCore extends ProseMirrorDevtoolsCore {
  override mount(element: HTMLElement, props: SvelteHostPanelProps): void {
    const { devtoolsProps, theme, devtoolsOpen } = props;
    super.mount(element, { ...devtoolsProps, theme, devtoolsOpen });
  }
}

const [SveltePanel] = createSveltePanel<SvelteHostPanelProps, ProseMirrorDevtoolsSvelteCore>(
  ProseMirrorDevtoolsSvelteCore,
);

export const ProseMirrorDevtoolsPanel: Component<ProseMirrorDevtoolsSveltePanelProps> = (
  internals,
  props,
) => {
  const { theme, devtoolsOpen } = resolveProseMirrorDevtoolsAdapterPanelProps(props.devtoolsProps);
  // The Svelte factory mounts the core once. TanStack can first mount a pane
  // while the workbench is closed and manage its visibility afterward.
  return SveltePanel(internals, { ...props, theme: props.theme ?? theme, devtoolsOpen });
};
