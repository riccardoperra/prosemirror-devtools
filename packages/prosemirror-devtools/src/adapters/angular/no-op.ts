import { createAngularPlugin, type DevtoolsPluginProps } from "@tanstack/devtools-utils/angular";

import { resolveProseMirrorDevtoolsPluginMetadata } from "../panel-props";
import type {
  CreateProseMirrorDevtoolsPluginOptions,
  ResolvedProseMirrorDevtoolsAdapterPanelProps,
} from "../types";
import type { InjectProseMirrorDevtoolsOptions } from "./inject-prosemirror-devtools";
import type { ProseMirrorDevtoolsAngularPanel } from "./panel";
import type { ProseMirrorDevtoolsAngularPlugin } from "./plugin";

type RuntimeProps = ResolvedProseMirrorDevtoolsAdapterPanelProps & DevtoolsPluginProps;

export const ProseMirrorDevtoolsPanelNoOp: ProseMirrorDevtoolsAngularPanel =
  () => (_inputs, _host) => () => {};

export function createProseMirrorDevtoolsPluginNoOp(
  options: CreateProseMirrorDevtoolsPluginOptions = {},
): ProseMirrorDevtoolsAngularPlugin {
  const [, PluginNoOp] = createAngularPlugin<RuntimeProps>({
    render: ProseMirrorDevtoolsPanelNoOp,
    ...resolveProseMirrorDevtoolsPluginMetadata(options),
  });
  return PluginNoOp();
}

export function injectProseMirrorDevtoolsNoOp(
  _options: () => InjectProseMirrorDevtoolsOptions,
): void {}
