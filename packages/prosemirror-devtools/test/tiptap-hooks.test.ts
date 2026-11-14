import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";

import { createProseMirrorDevtoolsStore } from "../src/core";
import { createTiptapDevtoolsHooks } from "../src/adapters/tiptap";
import { createTiptapInspector } from "../src/inspectors/tiptap";

const editors = new Set<Editor>();

afterEach(() => {
  for (const editor of editors) editor.destroy();
  editors.clear();
  document.body.replaceChildren();
});

function mount(extension: Extension, ...rest: Extension[]): Editor {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [extension, ...rest, StarterKit],
    content: "<p>First</p>",
  });
  editors.add(editor);
  return editor;
}

describe("createTiptapDevtoolsHooks", () => {
  it("records dispatches and detaches when spread into an application extension", () => {
    const store = createProseMirrorDevtoolsStore();
    const editor = mount(
      Extension.create({
        name: "prosemirrorDevtools",
        priority: 10_000,
        ...createTiptapDevtoolsHooks({ id: "hooks", store, performanceMarks: false }),
      }),
    );

    editor.commands.insertContent("x");

    expect(store.getInstance("hooks")?.transactions.at(-1)).toMatchObject({
      applicationStatus: "applied",
      docChanged: true,
    });
    editor.destroy();
    expect(store.getSnapshot().instances).toEqual([]);
  });

  it("passes the editor to options so inspectors can read it", () => {
    const store = createProseMirrorDevtoolsStore();
    const editor = mount(
      Extension.create({
        name: "prosemirrorDevtools",
        priority: 10_000,
        ...createTiptapDevtoolsHooks((current: Editor) => ({
          id: "hooks-inspector",
          store,
          performanceMarks: false,
          inspectors: [createTiptapInspector({ editor: current })],
        })),
      }),
      Extension.create({ name: "base", priority: 321 }).extend({ name: "inherited" }),
    );

    editor.commands.insertContent("y");

    const capture = store.getInstance("hooks-inspector")?.transactions.at(-1)?.inspection
      ?.projections[0]?.evidence;
    expect(capture).toMatchObject({ kind: "available" });
    expect(capture).toMatchObject({
      value: {
        extensions: expect.arrayContaining([
          expect.objectContaining({ name: "prosemirrorDevtools", priority: 10_000 }),
          expect.objectContaining({ name: "inherited", priority: 321 }),
          expect.objectContaining({ name: "paragraph" }),
        ]),
      },
    });
  });
});
