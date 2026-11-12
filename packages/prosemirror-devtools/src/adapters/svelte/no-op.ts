import type { Component } from "svelte";

import type { ProseMirrorDevtoolsSveltePanelProps } from "./panel";
import type {
  CreateProseMirrorDevtoolsSveltePluginOptions,
  ProseMirrorDevtoolsSveltePlugin,
} from "./plugin";

export const ProseMirrorDevtoolsPanelNoOp: Component<
  ProseMirrorDevtoolsSveltePanelProps
> = () => ({});

export function createProseMirrorDevtoolsPluginNoOp(
  options: CreateProseMirrorDevtoolsSveltePluginOptions = {},
): ProseMirrorDevtoolsSveltePlugin {
  return {
    name: options.name ?? "ProseMirror",
    component: ProseMirrorDevtoolsPanelNoOp,
    props: { devtoolsProps: options },
  };
}
