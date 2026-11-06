import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Plugin, PluginKey } from "prosemirror-state";
import { afterEach, describe, expect, it } from "vitest";

import { createProseMirrorDevtoolsStore } from "../src/core";
import {
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
} from "../src/adapters/tiptap";
import { createTiptapInspector } from "../src/inspectors/tiptap";

declare module "@tiptap/core" {
  interface Storage {
    counter: { count: number };
  }
}

const editors = new Set<Editor>();
afterEach(() => {
  for (const editor of editors) editor.destroy();
  editors.clear();
  document.body.replaceChildren();
});

describe("Tiptap extension inspector", () => {
  it("captures real extension metadata and only declared installed plugin associations", () => {
    const store = createProseMirrorDevtoolsStore();
    const key = new PluginKey("known-counter");
    const counter = Extension.create<{ label: string }, { count: number }>({
      name: "counter",
      priority: 321,
      addOptions: () => ({ label: "Observed counter" }),
      addStorage: () => ({ count: 0 }),
      addProseMirrorPlugins: () => [new Plugin({ key })],
    });
    const inspectorExtension = Extension.create({
      name: "inspector",
      onBeforeCreate() {
        setupTiptapDevtools(this.editor, {
          id: "tiptap-inspector",
          store,
          performanceMarks: false,
          inspectors: [
            createTiptapInspector({
              editor: this.editor,
              pluginAssociations: [{ extensionName: "counter", pluginKeys: [key] }],
            }),
          ],
        });
      },
      dispatchTransaction(props) {
        dispatchTiptapTransaction(this.editor, props);
      },
      onDestroy() {
        detachTiptapDevtools(this.editor);
      },
    });
    const editor = new Editor({
      extensions: [StarterKit.configure({ trailingNode: false }), counter, inspectorExtension],
      content: "<p>Alpha</p>",
      enableExtensionDispatchTransaction: true,
    });
    editors.add(editor);
    editor.commands.insertContent("x");
    const initial =
      store.getInstance("tiptap-inspector")?.transactions[0]?.inspection?.projections[0]?.evidence;
    expect(initial).toMatchObject({
      kind: "available",
      value: {
        sample: "dispatch",
        externalStorageChanges: "unobserved-between-samples",
        extensions: expect.arrayContaining([
          {
            name: "counter",
            type: "extension",
            priority: 321,
            options: { kind: "available", value: { label: "Observed counter" } },
            storage: { kind: "available", value: { count: 0 } },
            plugins: {
              kind: "application-declared",
              installedIndices: [expect.any(Number)],
              missingKeys: 0,
              additionalGeneratedPlugins: "unobserved",
            },
          },
        ]),
      },
    });
    editor.storage.counter.count = 9;
    editor.commands.insertContent("y");
    const later =
      store.getInstance("tiptap-inspector")?.transactions[1]?.inspection?.projections[0]?.evidence;
    expect(later).toMatchObject({
      kind: "available",
      value: {
        extensions: expect.arrayContaining([
          expect.objectContaining({
            name: "counter",
            storage: { kind: "available", value: { count: 9 } },
          }),
        ]),
      },
    });
    expect(initial).toMatchObject({
      kind: "available",
      value: {
        extensions: expect.arrayContaining([
          expect.objectContaining({
            name: "counter",
            storage: { kind: "available", value: { count: 0 } },
          }),
        ]),
      },
    });
  });
});
