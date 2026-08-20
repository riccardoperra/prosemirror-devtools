import { h, type JSX } from "preact";
import { createPreactPlugin, type DevtoolsPanelProps } from "@tanstack/devtools-utils/preact";

import {
  resolveProseMirrorDevtoolsAdapterPanelProps,
  resolveProseMirrorDevtoolsPluginMetadata,
} from "../adapters/panel-props";
import type { CreateProseMirrorDevtoolsPluginOptions } from "../adapters/types";
import { ProseMirrorDevtoolsPanel } from "./panel";

export type ProseMirrorDevtoolsPreactPlugin = ReturnType<ReturnType<typeof createPreactPlugin>[0]>;

export function createProseMirrorDevtoolsPlugin(
  options: CreateProseMirrorDevtoolsPluginOptions = {},
): ProseMirrorDevtoolsPreactPlugin {
  const Component = (hostProps: DevtoolsPanelProps): JSX.Element =>
    h(ProseMirrorDevtoolsPanel, resolveProseMirrorDevtoolsAdapterPanelProps(options, hostProps));
  const config: Parameters<typeof createPreactPlugin>[0] = {
    Component,
    ...resolveProseMirrorDevtoolsPluginMetadata(options),
  };

  const [Plugin] = createPreactPlugin(config);
  return Plugin();
}
