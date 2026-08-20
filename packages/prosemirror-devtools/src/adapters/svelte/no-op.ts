import { createSveltePlugin } from "@tanstack/devtools-utils/svelte";
import type { Component } from "svelte";

import type { ProseMirrorDevtoolsSveltePanelProps } from "./panel";
import type {
  CreateProseMirrorDevtoolsSveltePluginOptions,
  ProseMirrorDevtoolsSveltePlugin,
} from "./plugin";

export const ProseMirrorDevtoolsPanelNoOp =
  (() => ({})) as Component<ProseMirrorDevtoolsSveltePanelProps>;

export function createProseMirrorDevtoolsPluginNoOp(
  options: CreateProseMirrorDevtoolsSveltePluginOptions = {},
): ProseMirrorDevtoolsSveltePlugin {
  const [, PluginNoOp] = createSveltePlugin(
    options.name ?? "ProseMirror",
    ProseMirrorDevtoolsPanelNoOp,
  );
  return PluginNoOp({ devtoolsProps: options }) as ProseMirrorDevtoolsSveltePlugin;
}
