import { Plugin, type Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProseMirrorDevtoolsDiagnostics, createProseMirrorDevtoolsStore } from "../src/core";
import {
  attachTiptapDevtools,
  detachTiptapDevtools,
  dispatchTiptapTransaction,
  setupTiptapDevtools,
  type TiptapDevtoolsEditor,
} from "../src/adapters/tiptap";
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
  it("forwards diagnostics through generated plugins and native dispatch middleware", () => {
    const diagnostics = createProseMirrorDevtoolsDiagnostics();
    const store = createProseMirrorDevtoolsStore();
    const plugin = new Plugin({
      props: {
        handleKeyDown(view) {
          view.dispatch(view.state.tr.insertText("x"));
          return true;
        },
      },
    });
    const manager = new TestExtensionManager([plugin]);
    const editor = { extensionManager: manager } as unknown as TiptapDevtoolsEditor;
    setupTiptapDevtools(editor, {
      id: "diagnostic-editor",
      store,
      diagnostics,
      performanceMarks: false,
    });
    const view = createTestView(createTestState(), {
      dispatchTransaction(transaction) {
        dispatchTiptapTransaction(editor, {
          transaction,
          next: (next) => view.updateState(view.state.apply(next)),
        });
      },
    });
    setEditorView(editor, view);
    const [wrapped] = manager.plugins;
    view.updateState(view.state.reconfigure({ plugins: [wrapped!] }));

    expect(wrapped!.props.handleKeyDown?.call(wrapped!, view, new KeyboardEvent("keydown"))).toBe(
      true,
    );
    expect(store.getInstance("diagnostic-editor")?.diagnostics).toBe(diagnostics);
    expect(diagnostics.getSnapshot().events[0]).toMatchObject({
      name: "handleKeyDown",
      handled: true,
      dispatches: [{ instanceId: "diagnostic-editor", id: 1 }],
    });

    detachTiptapDevtools(editor);
    diagnostics.clearEvents();
    // Detached wrappers still execute application handlers, but cannot reactivate diagnostics.
    const passiveView = { state: createTestState(), dispatch: vi.fn() } as unknown as EditorView;
    wrapped!.props.handleKeyDown?.call(wrapped!, passiveView, new KeyboardEvent("keydown"));
    expect(passiveView.dispatch).toHaveBeenCalledOnce();
    expect(diagnostics.getSnapshot().events).toEqual([]);
    view.destroy();
    diagnostics.dispose();
  });

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

  it("cannot reactivate a detached integration through a later plugin getter wrapper", () => {
    const plugin = new Plugin({});
    const manager = new TestExtensionManager([plugin]);
    const editor: TiptapDevtoolsEditor = {
      extensionManager: manager,
      view: createTestView(),
    };
    const store = createProseMirrorDevtoolsStore();
    setupTiptapDevtools(editor, { id: "chained-getter", store });
    const instrumentedGetter = Object.getOwnPropertyDescriptor(manager, "plugins")!.get!;
    const chainedGetter = function (this: object) {
      return instrumentedGetter.call(this);
    };
    Object.defineProperty(manager, "plugins", { configurable: true, get: chainedGetter });

    detachTiptapDevtools(editor);

    expect(Object.getOwnPropertyDescriptor(manager, "plugins")?.get).toBe(chainedGetter);
    expect(manager.plugins[0]).toBe(plugin);
    expect(store.getSnapshot().instances).toEqual([]);
    editor.view.destroy();
  });

  it("restores instrumentation and releases ownership when session cleanup throws", () => {
    const manager = new TestExtensionManager([]);
    const editor: TiptapDevtoolsEditor = {
      extensionManager: manager,
      view: createTestView(),
    };
    const store = createProseMirrorDevtoolsStore();
    setupTiptapDevtools(editor, { id: "cleanup-error", store });
    const closeSession = vi.spyOn(store, "closeSession").mockImplementationOnce(() => {
      throw new Error("session cleanup failed");
    });

    expect(() => detachTiptapDevtools(editor)).toThrow("session cleanup failed");
    expect(Object.getOwnPropertyDescriptor(manager, "plugins")).toBeUndefined();
    expect(store.getSnapshot().instances).toEqual([]);
    expect(() => detachTiptapDevtools(editor)).not.toThrow();

    setupTiptapDevtools(editor, { id: "reattached", store });
    expect(store.getSnapshot().instances[0]?.id).toBe("reattached");
    detachTiptapDevtools(editor);
    expect(closeSession).toHaveBeenCalledTimes(2);
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
