import type { Component } from "svelte";

import type { ProseMirrorDevtoolsPanelInit } from "../types";
import { ProseMirrorDevtoolsPanel, type ProseMirrorDevtoolsSveltePanelProps } from "./panel";

export interface CreateProseMirrorDevtoolsSveltePluginOptions extends ProseMirrorDevtoolsPanelInit {
  name?: string;
}

export interface ProseMirrorDevtoolsSveltePlugin {
  name: string;
  component: Component<ProseMirrorDevtoolsSveltePanelProps>;
  props: ProseMirrorDevtoolsSveltePanelProps;
}

export function createProseMirrorDevtoolsPlugin(
  options: CreateProseMirrorDevtoolsSveltePluginOptions = {},
): ProseMirrorDevtoolsSveltePlugin {
  return {
    name: options.name ?? "ProseMirror",
    component: ProseMirrorDevtoolsPanel,
    props: { devtoolsProps: options },
  };
}
