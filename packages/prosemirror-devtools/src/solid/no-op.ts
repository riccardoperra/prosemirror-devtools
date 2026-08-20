import { type JSX } from "solid-js";
import { createSolidPlugin } from "@tanstack/devtools-utils/solid";
import type { EditorView } from "prosemirror-view";

import { resolveProseMirrorDevtoolsPluginMetadata } from "../adapters/panel-props";
import type { CreateProseMirrorDevtoolsPluginOptions } from "../adapters/types";
import type { ProseMirrorDevtoolsSolidInit } from "./panel";
import type { ProseMirrorDevtoolsSolidPlugin } from "./plugin";
import type { MaybeAccessor, UseProseMirrorDevtoolsOptions } from "./use-prosemirror-devtools";

export function ProseMirrorDevtoolsPanelNoOp(
  _props: ProseMirrorDevtoolsSolidInit = {},
): JSX.Element {
  return [];
}

export function createProseMirrorDevtoolsPluginNoOp(
  options: CreateProseMirrorDevtoolsPluginOptions = {},
): ProseMirrorDevtoolsSolidPlugin {
  const [, PluginNoOp] = createSolidPlugin({
    Component: ProseMirrorDevtoolsPanelNoOp,
    ...resolveProseMirrorDevtoolsPluginMetadata(options),
  });
  return PluginNoOp();
}

export function useProseMirrorDevtoolsNoOp(
  _view: MaybeAccessor<EditorView | null | undefined>,
  _options: MaybeAccessor<UseProseMirrorDevtoolsOptions>,
): void {}
