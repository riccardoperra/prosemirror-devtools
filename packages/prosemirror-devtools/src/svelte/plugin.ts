import { createSveltePlugin } from "@tanstack/devtools-utils/svelte";

import type { ProseMirrorDevtoolsPanelInit } from "../adapters/types";
import { ProseMirrorDevtoolsPanel, type ProseMirrorDevtoolsSveltePanelProps } from "./panel";

export interface CreateProseMirrorDevtoolsSveltePluginOptions extends ProseMirrorDevtoolsPanelInit {
  name?: string;
}

export type ProseMirrorDevtoolsSveltePlugin = ReturnType<
  ReturnType<typeof createSveltePlugin<ProseMirrorDevtoolsSveltePanelProps>>[0]
>;

export function createProseMirrorDevtoolsPlugin(
  options: CreateProseMirrorDevtoolsSveltePluginOptions = {},
): ProseMirrorDevtoolsSveltePlugin {
  const [Plugin] = createSveltePlugin(options.name ?? "ProseMirror", ProseMirrorDevtoolsPanel);
  const props: ProseMirrorDevtoolsSveltePanelProps = { devtoolsProps: options };
  return Plugin(props);
}
