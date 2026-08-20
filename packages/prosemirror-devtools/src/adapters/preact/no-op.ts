import { Fragment, h, type JSX } from "preact";
import { createPreactPlugin } from "@tanstack/devtools-utils/preact";
import type { EditorView } from "prosemirror-view";

import { resolveProseMirrorDevtoolsPluginMetadata } from "../panel-props";
import type { CreateProseMirrorDevtoolsPluginOptions } from "../types";
import type { ProseMirrorDevtoolsPreactInit } from "./panel";
import type { ProseMirrorDevtoolsPreactPlugin } from "./plugin";
import type { UseProseMirrorDevtoolsOptions } from "./use-prosemirror-devtools";

export function ProseMirrorDevtoolsPanelNoOp(
  _props: ProseMirrorDevtoolsPreactInit = {},
): JSX.Element {
  return h(Fragment, {});
}

export function createProseMirrorDevtoolsPluginNoOp(
  options: CreateProseMirrorDevtoolsPluginOptions = {},
): ProseMirrorDevtoolsPreactPlugin {
  const [, PluginNoOp] = createPreactPlugin({
    Component: ProseMirrorDevtoolsPanelNoOp,
    ...resolveProseMirrorDevtoolsPluginMetadata(options),
  });
  return PluginNoOp();
}

export function useProseMirrorDevtoolsNoOp(
  _view: EditorView | null | undefined,
  _options: UseProseMirrorDevtoolsOptions,
): void {}
