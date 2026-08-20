import { createVuePlugin } from "@tanstack/devtools-utils/vue";

import type { ProseMirrorDevtoolsPanelInit } from "../adapters/types";
import { ProseMirrorDevtoolsPanel, type ProseMirrorDevtoolsVueInit } from "./panel";

export interface CreateProseMirrorDevtoolsVuePluginOptions extends ProseMirrorDevtoolsPanelInit {
  name?: string;
}

type VuePluginFactories = ReturnType<typeof createVuePlugin<ProseMirrorDevtoolsVueInit>>;
export type ProseMirrorDevtoolsVuePlugin =
  | ReturnType<VuePluginFactories[0]>
  | ReturnType<VuePluginFactories[1]>;

export function createProseMirrorDevtoolsPlugin(
  options: CreateProseMirrorDevtoolsVuePluginOptions = {},
): ProseMirrorDevtoolsVuePlugin {
  const [Plugin] = createVuePlugin(options.name ?? "ProseMirror", ProseMirrorDevtoolsPanel);
  return Plugin(options);
}
