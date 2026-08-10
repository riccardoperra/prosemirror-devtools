import { Plugin, type Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProseMirrorDevtoolsStore } from "../src/core";
import {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
  type TiptapDevtoolsEditor,
} from "../src/tiptap";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

class TestExtensionManager {
  constructor(private readonly rawPlugins: readonly Plugin[]) {}

  get plugins(): Plugin[] {
    return [...this.rawPlugins];
  }
}

function setEditorView(editor: TiptapDevtoolsEditor, view: EditorView): void {
  Object.defineProperty(editor, "view", {
    configurable: true,
    value: view,
    writable: true,
  });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("Tiptap lifecycle helpers", () => {
  it("instruments plugins and records through Tiptap's native dispatch middleware", () => {
    let clock = 100;
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    const plugin = new Plugin<number>({
      state: {
        init() {
          clock += 2;
          return 0;
        },
        apply(_transaction, value) {
          clock += 5;
          return value + 1;
        },
      },
    });
    const manager = new TestExtensionManager([plugin]);
    const editor = { extensionManager: manager } as unknown as TiptapDevtoolsEditor;
    const store = createProseMirrorDevtoolsStore();
    const options = {
      id: "main",
      store,
      performanceMarks: false,
    } as const;

    expect(Object.getOwnPropertyDescriptor(manager, "plugins")).toBeUndefined();

    setupTiptapDevtools(editor, options);
    const patchedDescriptor = Object.getOwnPropertyDescriptor(manager, "plugins");
    setupTiptapDevtools(editor, options);
    expect(Object.getOwnPropertyDescriptor(manager, "plugins")?.get).toBe(patchedDescriptor?.get);

    const baseDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      const applied = this.state.applyTransaction(transaction);
      this.updateState(applied.state);
    });
    const nativeDispatch = function (this: EditorView, transaction: Transaction) {
      dispatchTiptapTransaction(editor, {
        transaction,
        next: (nextTransaction) => baseDispatch.call(this, nextTransaction),
      });
    };
    const view = createTestView(createTestState(), { dispatchTransaction: nativeDispatch });
    setEditorView(editor, view);

    // Tiptap reads this getter after assigning its EditorView. The adapter can
    // therefore attach before Tiptap installs the generated plugins.
    const plugins = manager.plugins;
    expect(plugins[0]).not.toBe(plugin);
    expect(view.props.dispatchTransaction).toBe(nativeDispatch);
    expect(store.getSnapshot().instances[0]?.id).toBe("main");

    view.updateState(view.state.reconfigure({ plugins }));
    expect(plugin.getState(view.state)).toBe(0);
    view.dispatch(appendTextTransaction(view.state, "x"));

    expect(baseDispatch).toHaveBeenCalledOnce();
    expect(plugin.getState(view.state)).toBe(1);
    expect(store.getSnapshot().instances[0]?.transactions[0]?.timings).toEqual([
      expect.objectContaining({ hook: "state.apply", duration: 5 }),
    ]);

    // Calling the explicit onCreate helper is a no-op once eagerly attached.
    const attachedDispatch = view.props.dispatchTransaction;
    attachTiptapDevtools(editor);
    expect(view.props.dispatchTransaction).toBe(attachedDispatch);

    detachTiptapDevtools(editor);
    detachTiptapDevtools(editor);
    expect(Object.getOwnPropertyDescriptor(manager, "plugins")).toBeUndefined();
    expect(view.props.dispatchTransaction).toBe(nativeDispatch);
    expect(store.getSnapshot().instances).toEqual([]);

    view.destroy();
  });

  it("can attach on create without intercepting Tiptap's plugin getter", () => {
    const plugin = new Plugin({});
    const manager = new TestExtensionManager([plugin]);
    const editor = { extensionManager: manager } as unknown as TiptapDevtoolsEditor;
    const store = createProseMirrorDevtoolsStore();
    setupTiptapDevtools(editor, {
      id: "dispatch-only",
      instrumentPlugins: false,
      performanceMarks: false,
      store,
    });

    expect(Object.getOwnPropertyDescriptor(manager, "plugins")).toBeUndefined();
    expect(manager.plugins[0]).toBe(plugin);

    const baseDispatch = vi.fn(function (this: EditorView, transaction: Transaction) {
      const applied = this.state.applyTransaction(transaction);
      this.updateState(applied.state);
    });
    const nativeDispatch = function (this: EditorView, transaction: Transaction) {
      dispatchTiptapTransaction(editor, {
        transaction,
        next: (nextTransaction) => baseDispatch.call(this, nextTransaction),
      });
    };
    const view = createTestView(createTestState(), { dispatchTransaction: nativeDispatch });
    setEditorView(editor, view);
    attachTiptapDevtools(editor);
    view.dispatch(appendTextTransaction(view.state, "x"));

    expect(baseDispatch).toHaveBeenCalledOnce();
    expect(store.getSnapshot().instances[0]?.transactions).toHaveLength(1);
    expect(store.getSnapshot().instances[0]?.transactions[0]?.timings).toEqual([]);

    detachTiptapDevtools(editor);
    expect(view.props.dispatchTransaction).toBe(nativeDispatch);
    view.destroy();
  });

  it("fails clearly when plugin instrumentation is unavailable", () => {
    const editor = {
      extensionManager: { plugins: [] },
    } as unknown as TiptapDevtoolsEditor;

    expect(() => setupTiptapDevtools(editor, { id: "unsupported" })).toThrow(
      /extensionManager\.plugins is not exposed as a getter/,
    );
  });

  it("requires setup before the onCreate helper", () => {
    const editor = {
      extensionManager: new TestExtensionManager([]),
      view: createTestView(),
    } as TiptapDevtoolsEditor;

    expect(() => attachTiptapDevtools(editor)).toThrow(
      /setupTiptapDevtools must be called from onBeforeCreate/,
    );
    editor.view.destroy();
  });

  it("requires setup before the dispatch middleware helper", () => {
    const editor = {
      extensionManager: new TestExtensionManager([]),
      view: createTestView(),
    } as TiptapDevtoolsEditor;

    expect(() =>
      dispatchTiptapTransaction(editor, {
        transaction: appendTextTransaction(editor.view.state, "x"),
        next: () => {},
      }),
    ).toThrow(/setupTiptapDevtools must be called from onBeforeCreate/);
    editor.view.destroy();
  });
});
