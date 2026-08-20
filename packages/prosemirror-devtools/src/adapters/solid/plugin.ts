import { createComponent, type JSX } from "solid-js";
import { createSolidPlugin, type DevtoolsPanelProps } from "@tanstack/devtools-utils/solid";

import { resolveProseMirrorDevtoolsPluginMetadata } from "../panel-props";
import type { CreateProseMirrorDevtoolsPluginOptions } from "../types";
import { ProseMirrorDevtoolsPanel, resolveProseMirrorDevtoolsSolidProps } from "./panel";

export type ProseMirrorDevtoolsSolidPlugin = ReturnType<ReturnType<typeof createSolidPlugin>[0]>;

export function createProseMirrorDevtoolsPlugin(
  options: CreateProseMirrorDevtoolsPluginOptions = {},
): ProseMirrorDevtoolsSolidPlugin {
  const Component = (hostProps: DevtoolsPanelProps): JSX.Element =>
    createComponent(
      ProseMirrorDevtoolsPanel,
      resolveProseMirrorDevtoolsSolidProps(options, hostProps),
    );
  const config: Parameters<typeof createSolidPlugin>[0] = {
    Component,
    ...resolveProseMirrorDevtoolsPluginMetadata(options),
  };

  const [Plugin] = createSolidPlugin(config);
  return Plugin();
}
