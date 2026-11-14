import { Extension, type Editor } from "@tiptap/core";
import { createTiptapInspector } from "prosemirror-inspector/inspectors/tiptap";
import {
  createTiptapDevtoolsHooks,
  type TiptapDevtoolsOptions,
} from "prosemirror-inspector/tiptap";

/**
 * Copy this file into your project. prosemirror-inspector does not depend on Tiptap, so the
 * extension lives in your code and uses your copy of @tiptap/core.
 */
export function createTiptapDevtools(options: TiptapDevtoolsOptions) {
  return Extension.create({
    name: "prosemirrorDevtools",
    // Runs first, so the measured dispatch includes every lower-priority dispatch middleware.
    priority: 10_000,
    ...createTiptapDevtoolsHooks((editor: Editor) => ({
      ...options,
      inspectors: [createTiptapInspector({ editor }), ...(options.inspectors ?? [])],
    })),
  });
}
