import { createElement, Fragment, type ReactElement } from "react";
import { createReactPlugin } from "@tanstack/devtools-utils/react";
import type { EditorView } from "prosemirror-view";

import { resolveProseMirrorDevtoolsPluginMetadata } from "../panel-props";
import type { CreateProseMirrorDevtoolsPluginOptions } from "../types";
import type { ProseMirrorDevtoolsReactInit } from "./panel";
import type { ProseMirrorDevtoolsReactPlugin } from "./plugin";
import type { UseProseMirrorDevtoolsOptions } from "./use-prosemirror-devtools";

export function ProseMirrorDevtoolsPanelNoOp(
  _props: ProseMirrorDevtoolsReactInit = {},
): ReactElement {
  return createElement(Fragment);
}

export function createProseMirrorDevtoolsPluginNoOp(
  options: CreateProseMirrorDevtoolsPluginOptions = {},
): ProseMirrorDevtoolsReactPlugin {
  const [, PluginNoOp] = createReactPlugin({
    Component: ProseMirrorDevtoolsPanelNoOp,
    ...resolveProseMirrorDevtoolsPluginMetadata(options),
  });
  return PluginNoOp();
}

export function useProseMirrorDevtoolsNoOp(
  _view: EditorView | null | undefined,
  _options: UseProseMirrorDevtoolsOptions,
): void {}
