import { isDevMode } from "@angular/core";

import * as injection from "./inject-prosemirror-devtools";
import * as noOp from "./no-op";
import * as panel from "./panel";
import * as plugin from "./plugin";

const development = isDevMode();

export const ProseMirrorDevtoolsPanel: typeof panel.ProseMirrorDevtoolsPanel = development
  ? panel.ProseMirrorDevtoolsPanel
  : noOp.ProseMirrorDevtoolsPanelNoOp;
export const createProseMirrorDevtoolsPlugin: typeof plugin.createProseMirrorDevtoolsPlugin =
  development ? plugin.createProseMirrorDevtoolsPlugin : noOp.createProseMirrorDevtoolsPluginNoOp;
export const injectProseMirrorDevtools: typeof injection.injectProseMirrorDevtools = development
  ? injection.injectProseMirrorDevtools
  : noOp.injectProseMirrorDevtoolsNoOp;

export type { CreateProseMirrorDevtoolsPluginOptions } from "../types";
export type { InjectProseMirrorDevtoolsOptions } from "./inject-prosemirror-devtools";
export type { ProseMirrorDevtoolsAngularInit, ProseMirrorDevtoolsAngularPanel } from "./panel";
export type { ProseMirrorDevtoolsAngularPlugin } from "./plugin";
