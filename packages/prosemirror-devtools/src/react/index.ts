"use client";

import * as panel from "./panel";
import * as plugin from "./plugin";
import * as noOp from "./no-op";
import * as registration from "./use-prosemirror-devtools";

const development = process.env.NODE_ENV === "development";

export const ProseMirrorDevtoolsPanel: typeof panel.ProseMirrorDevtoolsPanel = development
  ? panel.ProseMirrorDevtoolsPanel
  : noOp.ProseMirrorDevtoolsPanelNoOp;
export const createProseMirrorDevtoolsPlugin: typeof plugin.createProseMirrorDevtoolsPlugin =
  development ? plugin.createProseMirrorDevtoolsPlugin : noOp.createProseMirrorDevtoolsPluginNoOp;
export const useProseMirrorDevtools: typeof registration.useProseMirrorDevtools = development
  ? registration.useProseMirrorDevtools
  : noOp.useProseMirrorDevtoolsNoOp;

export { createReactDevtoolsExtension } from "./extension";
export type { ReactDevtoolsExtensionOptions, ReactDevtoolsPanelExtension } from "./extension";
export type { CreateProseMirrorDevtoolsPluginOptions } from "../adapters/types";
export type { ProseMirrorDevtoolsPanelProps, ProseMirrorDevtoolsTab } from "../panel/panel.types";
export type { ProseMirrorDevtoolsReactInit } from "./panel";
export type { ProseMirrorDevtoolsReactPlugin } from "./plugin";
export type { UseProseMirrorDevtoolsOptions } from "./use-prosemirror-devtools";
