import { createAngularPlugin, type DevtoolsPluginProps } from "@tanstack/devtools-utils/angular";

import type {
  CreateProseMirrorDevtoolsPluginOptions,
  ResolvedProseMirrorDevtoolsAdapterPanelProps,
} from "../types";
import {
  resolveProseMirrorDevtoolsPanelInit,
  resolveProseMirrorDevtoolsPluginMetadata,
} from "../panel-props";
import { ProseMirrorDevtoolsPanel } from "./panel";

type RuntimeProps = ResolvedProseMirrorDevtoolsAdapterPanelProps & DevtoolsPluginProps;
type AngularPluginFactories = ReturnType<typeof createAngularPlugin<RuntimeProps>>;
export type ProseMirrorDevtoolsAngularPlugin =
  | ReturnType<AngularPluginFactories[0]>
  | ReturnType<AngularPluginFactories[1]>;

export function createProseMirrorDevtoolsPlugin(
  options: CreateProseMirrorDevtoolsPluginOptions = {},
): ProseMirrorDevtoolsAngularPlugin {
  const config: Parameters<typeof createAngularPlugin<RuntimeProps>>[0] = {
    render: ProseMirrorDevtoolsPanel,
    ...resolveProseMirrorDevtoolsPluginMetadata(options),
  };

  const [Plugin] = createAngularPlugin(config);
  const inputs = resolveProseMirrorDevtoolsPanelInit(options) as RuntimeProps;
  return Plugin(inputs);
}
