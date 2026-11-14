import { Editor, Extension, Node, type AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { act, createElement, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Plugin, PluginKey } from "prosemirror-state";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProseMirrorDevtoolsDiagnostics, createProseMirrorDevtoolsStore } from "../src/core";
import {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
  suspendTiptapDevtools,
  resumeTiptapDevtools,
  type TiptapDevtoolsOptions,
} from "../src/adapters/tiptap";

const editors = new Set<Editor>();

function inspectorExtension(options: TiptapDevtoolsOptions) {
  return Extension.create({
    name: "inspector",
    priority: 10000,
    onBeforeCreate() {
      setupTiptapDevtools(this.editor, options);
    },
    onCreate() {
      attachTiptapDevtools(this.editor);
    },
    dispatchTransaction(props) {
      dispatchTiptapTransaction(this.editor, props);
    },
    onDestroy() {
      detachTiptapDevtools(this.editor);
    },
  });
}

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "inline*",
  parseHTML: () => [{ tag: "aside" }],
  renderHTML: () => ["aside", 0],
  addNodeView:
    () =>
    ({ node }) => {
      const dom = document.createElement("aside");
      return {
        dom,
        contentDOM: dom,
        update: (next) => next.type === node.type,
      };
    },
});

function createEditor(
  options: TiptapDevtoolsOptions,
  content = "<ul><li><p>First item</p></li></ul>",
  extensions: AnyExtension[] = [],
): Editor {
  const inspector = inspectorExtension(options);
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({
    element,
    extensions: [inspector, StarterKit, ...extensions],
    content,
    enableExtensionDispatchTransaction: true,
  });
  editors.add(editor);
  return editor;
}

afterEach(() => {
  for (const editor of editors) editor.destroy();
  editors.clear();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("native Tiptap 3 integration", () => {
  it.each([true, false])(
    "records one middleware dispatch with plugin instrumentation %s",
    (instrumentPlugins) => {
      const store = createProseMirrorDevtoolsStore();
      const diagnostics = createProseMirrorDevtoolsDiagnostics();
      const editor = createEditor({
        id: "native-tiptap",
        store,
        diagnostics,
        instrumentPlugins,
        performanceMarks: false,
      });
      const nativeDispatch = editor.view.props.dispatchTransaction;
      const before = store.getInstance("native-tiptap")?.transactions.length ?? 0;
      editor.commands.insertContent("x");

      expect(editor.state.doc.textContent).toBe("xFirst item");
      const instance = store.getInstance("native-tiptap");
      expect(instance?.transactions).toHaveLength(before + 1);
      expect(instance?.transactions.at(-1)).toMatchObject({
        applicationStatus: "applied",
        docChanged: true,
      });
      expect(editor.view.props.dispatchTransaction).toBe(nativeDispatch);
      expect(
        instance?.transactions.at(-1)?.timings.some((timing) => timing.hook === "state.apply"),
      ).toBe(instrumentPlugins);

      editor.destroy();
      expect(store.getSnapshot().instances).toEqual([]);
      diagnostics.dispose();
    },
  );

  it("closes the previous editor and recreates one recorder for the same application ID", () => {
    const store = createProseMirrorDevtoolsStore();
    const options = { id: "remounted-tiptap", store, performanceMarks: false };
    const first = createEditor(options);
    first.commands.insertContent("first");
    const firstSession = store.getInstance(options.id)?.transactions[0]?.sessionId;
    first.destroy();
    expect(store.getSnapshot().instances).toEqual([]);

    const second = createEditor(options);
    second.commands.insertContent("second");
    expect(store.getSnapshot().instances).toHaveLength(1);
    expect(store.getInstance(options.id)?.transactions[0]?.sessionId).not.toBe(firstSession);
    expect(store.getInstance(options.id)?.transactions).toHaveLength(1);
    expect(second.state.doc.textContent).toBe("secondFirst item");
  });

  it.each([true, false])(
    "survives React StrictMode, remount, and cleanup with instrumentation %s",
    async (instrumentPlugins) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const store = createProseMirrorDevtoolsStore();
      const current: { editor: Editor | null } = { editor: null };
      function Consumer() {
        const [extensions] = useState(() => [
          inspectorExtension({
            id: "strict-tiptap",
            store,
            instrumentPlugins,
            performanceMarks: false,
          }),
          StarterKit.configure({ trailingNode: false }),
        ]);
        const editor = useEditor({
          extensions,
          content: "<p>Alpha</p>",
          immediatelyRender: false,
          enableExtensionDispatchTransaction: true,
          onCreate: ({ editor: created }) => {
            current.editor = created;
          },
        });
        useEffect(() => {
          if (!editor) return;
          resumeTiptapDevtools(editor);
          return () => suspendTiptapDevtools(editor);
        }, [editor]);
        return createElement(EditorContent, { editor });
      }
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      try {
        await act(async () =>
          root.render(createElement(StrictMode, null, createElement(Consumer, { key: 1 }))),
        );
        await expect.poll(() => current.editor?.isInitialized).toBe(true);
        const first = current.editor;
        if (!first) throw new Error("Tiptap did not initialize");
        const before = store.getInstance("strict-tiptap")?.transactions.length ?? 0;
        await act(async () => first.commands.insertContent("x"));
        expect(store.getInstance("strict-tiptap")?.transactions).toHaveLength(before + 1);
        expect(container.querySelector("[contenteditable]")?.textContent).toBe("xAlpha");
        await act(async () =>
          root.render(createElement(StrictMode, null, createElement(Consumer, { key: 2 }))),
        );
        await expect
          .poll(() => current.editor !== first && current.editor?.isInitialized)
          .toBe(true);
        expect(store.getSnapshot().instances).toHaveLength(1);
        const second = current.editor;
        if (!second) throw new Error("Tiptap did not remount");
        const remountedBefore = store.getInstance("strict-tiptap")?.transactions.length ?? 0;
        await act(async () => second.commands.insertContent("y"));
        expect(store.getInstance("strict-tiptap")?.transactions).toHaveLength(remountedBefore + 1);
        expect(container.querySelector("[contenteditable]")?.textContent).toBe("yAlpha");
      } finally {
        await act(async () => root.unmount());
      }
      await expect.poll(() => store.getSnapshot().instances).toEqual([]);
    },
  );

  it("keeps dynamically registered plugins functional without inventing hook coverage", () => {
    const store = createProseMirrorDevtoolsStore();
    const editor = createEditor({ id: "dynamic-plugin", store, performanceMarks: false });
    const key = new PluginKey<number>("native-dynamic");
    const plugin = new Plugin({
      key,
      state: {
        init: () => 0,
        apply: (_transaction, count) => count + 1,
      },
    });
    editor.registerPlugin(plugin);
    editor.commands.insertContent("x");
    expect(key.getState(editor.state)).toBe(2);
    expect(store.getInstance("dynamic-plugin")?.transactions).toHaveLength(1);
    expect(
      store
        .getInstance("dynamic-plugin")
        ?.transactions[0]?.timings.some((timing) => timing.pluginKey.startsWith("native-dynamic$")),
    ).toBe(false);
    editor.unregisterPlugin(key);
    expect(key.getState(editor.state)).toBeUndefined();
  });

  it("records the lifecycle of node views that extensions add through addNodeView", () => {
    const store = createProseMirrorDevtoolsStore();
    const diagnostics = createProseMirrorDevtoolsDiagnostics();
    const editor = createEditor(
      { id: "tiptap-node-views", store, diagnostics, performanceMarks: false },
      "<aside>Note</aside><p>Body</p>",
      [Callout],
    );
    const callouts = () =>
      diagnostics.getSnapshot().nodeViews.filter((record) => record.nodeType === "callout");

    expect(callouts()).toEqual([
      expect.objectContaining({ destroyed: false, updates: 0, destroys: 0 }),
    ]);

    editor.commands.insertContentAt(2, "!");
    expect(editor.state.doc.firstChild?.textContent).toBe("N!ote");
    expect(callouts()).toHaveLength(1);
    expect(callouts()[0]?.updates).toBeGreaterThan(0);

    editor.setOptions({ editorProps: {} });
    editor.registerPlugin(new Plugin({ key: new PluginKey("late") }));
    editor.commands.insertContentAt(2, "?");
    expect(callouts()).toHaveLength(1);

    const calloutSize = editor.state.doc.firstChild?.nodeSize ?? 0;
    editor.commands.deleteRange({ from: 0, to: calloutSize });
    expect(editor.state.doc.firstChild?.type.name).toBe("paragraph");
    expect(callouts()).toEqual([expect.objectContaining({ destroyed: true, destroys: 1 })]);
    diagnostics.dispose();
  });

  it("creates diagnostics from true and disposes them when the editor is destroyed", () => {
    const store = createProseMirrorDevtoolsStore();
    const editor = createEditor(
      { id: "tiptap-owned-diagnostics", store, diagnostics: true, performanceMarks: false },
      "<aside>Note</aside><p>Body</p>",
      [Callout],
    );
    const diagnostics = store.getInstance("tiptap-owned-diagnostics")?.diagnostics;
    expect(diagnostics?.getSnapshot().nodeViews).toEqual([
      expect.objectContaining({ nodeType: "callout", destroyed: false }),
    ]);

    editor.destroy();
    expect(diagnostics?.getSnapshot().nodeViews).toEqual([]);
  });

  it("leaves a supplied diagnostics controller to its owner", () => {
    const store = createProseMirrorDevtoolsStore();
    const diagnostics = createProseMirrorDevtoolsDiagnostics();
    const editor = createEditor(
      { id: "tiptap-supplied-diagnostics", store, diagnostics, performanceMarks: false },
      "<aside>Note</aside><p>Body</p>",
      [Callout],
    );

    editor.destroy();
    expect(diagnostics.getSnapshot().nodeViews).toEqual([
      expect.objectContaining({ nodeType: "callout" }),
    ]);
    diagnostics.dispose();
  });
});
