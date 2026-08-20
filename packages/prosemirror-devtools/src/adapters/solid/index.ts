import * as noOp from "./no-op";
import * as panel from "./panel";
import * as plugin from "./plugin";
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

export type { CreateProseMirrorDevtoolsPluginOptions } from "../types";
export type { ProseMirrorDevtoolsSolidInit } from "./panel";
export type { ProseMirrorDevtoolsSolidPlugin } from "./plugin";
export type { MaybeAccessor, UseProseMirrorDevtoolsOptions } from "./use-prosemirror-devtools";
