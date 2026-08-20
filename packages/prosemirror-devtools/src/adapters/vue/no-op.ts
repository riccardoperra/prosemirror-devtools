import { defineComponent } from "vue";
import { createVuePlugin } from "@tanstack/devtools-utils/vue";
import type { EditorView } from "prosemirror-view";
import type { DefineComponent, MaybeRef } from "vue";

import type { ProseMirrorDevtoolsVueInit } from "./panel";
import type {
  CreateProseMirrorDevtoolsVuePluginOptions,
  ProseMirrorDevtoolsVuePlugin,
} from "./plugin";
import type { UseProseMirrorDevtoolsOptions } from "./use-prosemirror-devtools";

export const ProseMirrorDevtoolsPanelNoOp = defineComponent({
  name: "ProseMirrorDevtoolsPanelNoOp",
  setup: () => () => null,
}) as unknown as DefineComponent<ProseMirrorDevtoolsVueInit, {}, unknown>;

export function createProseMirrorDevtoolsPluginNoOp(
  options: CreateProseMirrorDevtoolsVuePluginOptions = {},
): ProseMirrorDevtoolsVuePlugin {
  const [, PluginNoOp] = createVuePlugin<ProseMirrorDevtoolsVueInit>(
    options.name ?? "ProseMirror",
    ProseMirrorDevtoolsPanelNoOp,
  );
  return PluginNoOp(options as ProseMirrorDevtoolsVueInit);
}

export function useProseMirrorDevtoolsNoOp(
  _view: MaybeRef<EditorView | null | undefined>,
  _options: MaybeRef<UseProseMirrorDevtoolsOptions>,
): void {}
