import * as noOp from "./no-op";
import * as panel from "./panel";
import * as plugin from "./plugin";

const development = process.env.NODE_ENV === "development";

export const ProseMirrorDevtoolsPanel: typeof panel.ProseMirrorDevtoolsPanel = development
  ? panel.ProseMirrorDevtoolsPanel
  : noOp.ProseMirrorDevtoolsPanelNoOp;
export const createProseMirrorDevtoolsPlugin: typeof plugin.createProseMirrorDevtoolsPlugin =
  development ? plugin.createProseMirrorDevtoolsPlugin : noOp.createProseMirrorDevtoolsPluginNoOp;

export type { ProseMirrorDevtoolsSvelteInit, ProseMirrorDevtoolsSveltePanelProps } from "./panel";
export type {
  CreateProseMirrorDevtoolsSveltePluginOptions,
  ProseMirrorDevtoolsSveltePlugin,
} from "./plugin";
