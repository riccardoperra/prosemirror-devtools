import { createElement, type FunctionComponent, type ReactElement } from "react";
import { createReactPlugin, type DevtoolsPanelProps } from "@tanstack/devtools-utils/react";

import {
  resolveProseMirrorDevtoolsAdapterPanelProps,
  resolveProseMirrorDevtoolsPluginMetadata,
} from "../adapters/panel-props";
import type { CreateProseMirrorDevtoolsPluginOptions } from "../adapters/types";
import { ProseMirrorDevtoolsPanel, type ProseMirrorDevtoolsReactInit } from "./panel";

export type ProseMirrorDevtoolsReactPlugin = ReturnType<ReturnType<typeof createReactPlugin>[0]>;

export function createProseMirrorDevtoolsPlugin(
  options: CreateProseMirrorDevtoolsPluginOptions = {},
): ProseMirrorDevtoolsReactPlugin {
  const Component = (hostProps: DevtoolsPanelProps): ReactElement => {
    const panelProps = resolveProseMirrorDevtoolsAdapterPanelProps(options, hostProps);
    const Panel = ProseMirrorDevtoolsPanel as FunctionComponent<ProseMirrorDevtoolsReactInit>;
    return createElement(Panel, panelProps as ProseMirrorDevtoolsReactInit);
  };
  const config: Parameters<typeof createReactPlugin>[0] = {
    Component,
    ...resolveProseMirrorDevtoolsPluginMetadata(options),
  };

  const [Plugin] = createReactPlugin(config);
  return Plugin();
}
