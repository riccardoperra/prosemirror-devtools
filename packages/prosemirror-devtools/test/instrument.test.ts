import type { EditorState } from "prosemirror-state";
import { Plugin, PluginKey } from "prosemirror-state";
import { DecorationSet, type EditorView } from "prosemirror-view";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachProseMirrorDevtools,
  instrumentProseMirrorPlugins,
  createProseMirrorDevtoolsStore,
} from "../src/core";
import { appendTextTransaction, createTestState, createTestView } from "./helpers";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("instrumentProseMirrorPlugins", () => {
  it("preserves subclass behavior and private fields while measuring plugin hooks", () => {
    const key = new PluginKey<number>("custom");
    class CustomPlugin extends Plugin<number> {
      label = "custom";
      #count = 2;

      get count() {
        return this.#count;
      }

      set count(value: number) {
        this.#count = value;
      }

      increment() {
        return ++this.#count;
      }

      override getState(state: EditorState) {
        const value = super.getState(state);
        return value === undefined ? undefined : value + this.#count;
      }
    }
    const original = new CustomPlugin({
      key,
      state: { init: () => 0, apply: (_transaction, value) => value + 1 },
      props: { handleKeyDown: () => true },
    });
    const originalSpec = original.spec;
    const originalProps = original.props;
    const store = createProseMirrorDevtoolsStore();
    const [wrapped] = instrumentProseMirrorPlugins([original], { instanceId: "editor", store });
    if (!wrapped) throw new Error("Expected an instrumented plugin");

    expect(wrapped).toBeInstanceOf(Plugin);
    expect(wrapped).toBeInstanceOf(CustomPlugin);
    if (!(wrapped instanceof CustomPlugin)) throw new Error("Expected a CustomPlugin");
    expect(wrapped.constructor).toBe(CustomPlugin);
    expect(wrapped.label).toBe("custom");
    expect("label" in wrapped).toBe(true);
    expect(Object.keys(wrapped)).toContain("label");
    wrapped.label = "updated";
    expect(original.label).toBe("updated");
    expect(wrapped.count).toBe(2);
    wrapped.count = 4;
    expect(wrapped.increment()).toBe(5);
    expect(original.count).toBe(5);
    expect(wrapped.increment).toBe(wrapped.increment);

    const view = createTestView(createTestState("", [wrapped]));
    const unregister = store.register({ id: "editor", view });
    expect(key.get(view.state)).toBe(wrapped);
    expect(key.get(view.state)).toBeInstanceOf(CustomPlugin);
    expect(wrapped.getState(view.state)).toBe(5);
    expect(wrapped.getState(view.state.apply(view.state.tr))).toBe(6);
    expect(wrapped.props.handleKeyDown?.call(wrapped, view, new KeyboardEvent("keydown"))).toBe(
      true,
    );
    expect(original.spec).toBe(originalSpec);
    expect(original.props).toBe(originalProps);
    expect(wrapped.spec).not.toBe(originalSpec);
    expect(wrapped.props).not.toBe(originalProps);
    expect(store.getInstance("editor")?.pluginTimings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hook: "state.init", count: 1 }),
        expect.objectContaining({ hook: "state.apply", count: 1 }),
        expect.objectContaining({ hook: "props.handleKeyDown", count: 1 }),
      ]),
    );
    unregister();
    view.destroy();
  });

  it("preserves subclass behavior when the original plugin is frozen", () => {
    class FrozenPlugin extends Plugin<number> {
      #count = 1;

      get count() {
        return this.#count;
      }

      increment() {
        return ++this.#count;
      }
    }
    const original = Object.freeze(
      new FrozenPlugin({
        state: { init: () => 0, apply: (_transaction, value) => value + 1 },
        props: { handleKeyDown: () => true },
      }),
    );
    const [wrapped] = instrumentProseMirrorPlugins([original], { instanceId: "frozen" });
    expect(wrapped).toBeInstanceOf(FrozenPlugin);
    if (!(wrapped instanceof FrozenPlugin)) throw new Error("Expected a FrozenPlugin");

    expect(wrapped.count).toBe(1);
    expect(wrapped.increment()).toBe(2);
    const view = createTestView(createTestState("", [wrapped]));
    expect(wrapped.getState(view.state)).toBe(0);
    expect(wrapped.getState(view.state.apply(view.state.tr))).toBe(1);
    expect(wrapped.props.handleKeyDown?.call(wrapped, view, new KeyboardEvent("keydown"))).toBe(
      true,
    );
    expect(original.count).toBe(2);
    view.destroy();
  });

  it("preserves generated keys, plugin state, and hook returns while aggregating timings", () => {
    let clock = 100;
    let applyCount = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    const original = new Plugin<{ count: number }>({
      state: {
        init() {
          clock += 3;
          return { count: 0 };
        },
        apply(transaction, value) {
          applyCount += 1;
          clock += applyCount === 1 ? 8 : 20;
          return transaction.getMeta("increment") ? { count: value.count + 1 } : value;
        },
      },
      filterTransaction() {
        clock += 5;
        return true;
      },
      appendTransaction() {
        clock += 7;
        return null;
      },
      props: {
        handleKeyDown(_view, event) {
          clock += 11;
          return event.key === "Enter";
        },
      },
    });
    const store = createProseMirrorDevtoolsStore();
    const registeredView = { state: createTestState() } as EditorView;
    store.register({ id: "editor", view: registeredView });

    const [wrapped] = instrumentProseMirrorPlugins([original], {
      instanceId: "editor",
      store,
      getPluginLabel: () => "Measured plugin",
    });
    if (!wrapped) throw new Error("Expected the plugin to be instrumented");
    const originalKey = (original as unknown as { key: string }).key;
    const wrappedKey = (wrapped as unknown as { key: string }).key;
    expect(wrapped).not.toBe(original);
    expect(wrappedKey).toBe(originalKey);

    let state = createTestState("", [wrapped]);
    expect(original.getState(state)).toEqual({ count: 0 });

    const records = [];
    for (let index = 0; index < 2; index += 1) {
      const transaction = appendTextTransaction(state, String(index)).setMeta("increment", true);
      const measurement = store.beginTransaction("editor", transaction, state, false);
      const applied = state.applyTransaction(transaction);

      if (index === 0) {
        const handled = wrapped.props.handleKeyDown?.call(wrapped, registeredView, {
          key: "Enter",
        } as KeyboardEvent);
        expect(handled).toBe(true);
      }

      const record = store.finishTransaction(measurement, {
        stateAfter: applied.state,
        appliedTransactions: applied.transactions,
      });
      records.push(record);
      state = applied.state;
      (registeredView as { state: EditorState }).state = state;
    }

    expect(original.getState(state)).toEqual({ count: 2 });
    expect(records[0]?.timings).toEqual([
      expect.objectContaining({ hook: "filterTransaction", duration: 5 }),
      expect.objectContaining({ hook: "state.apply", duration: 8 }),
      expect.objectContaining({ hook: "appendTransaction", duration: 7 }),
      expect.objectContaining({ hook: "props.handleKeyDown", duration: 11 }),
    ]);
    expect(records[1]?.timings).toEqual([
      expect.objectContaining({ hook: "filterTransaction", duration: 5 }),
      expect.objectContaining({ hook: "state.apply", duration: 20 }),
      expect.objectContaining({ hook: "appendTransaction", duration: 7 }),
    ]);

    const summaries = Object.fromEntries(
      (store.getSnapshot().instances[0]?.pluginTimings ?? []).map((summary) => [
        summary.hook,
        summary,
      ]),
    );
    expect(summaries["state.init"]).toMatchObject({
      pluginKey: originalKey,
      pluginLabel: "Measured plugin",
      count: 1,
      total: 3,
      average: 3,
      max: 3,
      last: 3,
    });
    expect(summaries["state.apply"]).toMatchObject({
      count: 2,
      total: 28,
      average: 14,
      max: 20,
      last: 20,
    });
    expect(summaries.filterTransaction).toMatchObject({ count: 2, total: 10 });
    expect(summaries.appendTransaction).toMatchObject({ count: 2, total: 14 });
    expect(summaries["props.handleKeyDown"]).toMatchObject({
      count: 1,
      total: 11,
    });
  });

  it("returns the cached wrapper for the same plugin, instance, and store", () => {
    const store = createProseMirrorDevtoolsStore();
    const original = new Plugin({});
    const options = { instanceId: "editor", store };

    const [first] = instrumentProseMirrorPlugins([original], options);
    const [second] = instrumentProseMirrorPlugins([original], options);

    expect(second).toBe(first);
  });

  it("isolates editors sharing an explicit session identifier", () => {
    const store = createProseMirrorDevtoolsStore();
    const original = new Plugin({ state: { init: () => 0, apply: (_tr, value) => value } });
    const [first] = instrumentProseMirrorPlugins([original], {
      instanceId: "first",
      sessionId: "shared",
      store,
    });
    const [second] = instrumentProseMirrorPlugins([original], {
      instanceId: "second",
      sessionId: "shared",
      store,
    });
    if (!first || !second) throw new Error("Expected instrumented plugins");

    const firstView = { state: createTestState("", [first]) } as EditorView;
    const secondView = { state: createTestState("", [second]) } as EditorView;
    store.register({ id: "first", sessionId: "shared", view: firstView });
    store.register({ id: "second", sessionId: "shared", view: secondView });

    expect(first).not.toBe(second);
    expect(store.getInstance("first")?.pluginTimings).toEqual([
      expect.objectContaining({ hook: "state.init", count: 1 }),
    ]);
    expect(store.getInstance("second")?.pluginTimings).toEqual([
      expect.objectContaining({ hook: "state.init", count: 1 }),
    ]);
  });

  it("honors changed labels when a plugin is instrumented again", () => {
    const store = createProseMirrorDevtoolsStore();
    const original = new Plugin({ state: { init: () => 0, apply: (_tr, value) => value } });
    const [first] = instrumentProseMirrorPlugins([original], {
      instanceId: "editor",
      store,
      getPluginLabel: () => "Old label",
    });
    if (!first) throw new Error("Expected an instrumented plugin");
    const view = { state: createTestState("", [first]) } as EditorView;
    store.register({ id: "editor", view });
    const [second] = instrumentProseMirrorPlugins([original], {
      instanceId: "editor",
      store,
      getPluginLabel: () => "Current label",
    });
    if (!second) throw new Error("Expected an instrumented plugin");
    createTestState("", [second]);

    expect(second).not.toBe(first);
    expect(store.getInstance("editor")?.pluginTimings).toEqual([
      expect.objectContaining({ pluginLabel: "Current label", count: 2 }),
    ]);
  });

  it("reuses the source plugin when a wrapper moves to another editor", () => {
    const store = createProseMirrorDevtoolsStore();
    const measure = vi.spyOn(store, "measurePluginHook");
    const init = vi.fn(() => 0);
    const original = new Plugin({ state: { init, apply: (_tr, value) => value } });
    const [first] = instrumentProseMirrorPlugins([original], { instanceId: "first", store });
    if (!first) throw new Error("Expected an instrumented plugin");
    const [second] = instrumentProseMirrorPlugins([first], { instanceId: "second", store });
    if (!second) throw new Error("Expected an instrumented plugin");

    createTestState("", [second]);

    expect(init).toHaveBeenCalledOnce();
    expect(measure).toHaveBeenCalledOnce();
    expect(measure.mock.calls[0]?.[0]).toBe("second");
  });

  it("buffers state initialization and view creation timings until the editor attaches", () => {
    let clock = 50;
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    const original = new Plugin<number>({
      state: {
        init() {
          clock += 4;
          return 0;
        },
        apply(_transaction, value) {
          return value;
        },
      },
      view() {
        clock += 6;
        return {};
      },
    });
    const store = createProseMirrorDevtoolsStore();
    const [wrapped] = instrumentProseMirrorPlugins([original], {
      instanceId: "editor",
      store,
      getPluginLabel: () => "Early plugin",
    });
    if (!wrapped) throw new Error("Expected the plugin to be instrumented");

    const state = createTestState("", [wrapped]);
    const view = createTestView(state);

    expect(store.getSnapshot().instances).toEqual([]);

    const attachment = attachProseMirrorDevtools({
      id: "editor",
      view,
      store,
      performanceMarks: false,
    });
    const summaries = Object.fromEntries(
      (store.getSnapshot().instances[0]?.pluginTimings ?? []).map((summary) => [
        summary.hook,
        summary,
      ]),
    );
    const pluginKey = (original as unknown as { key: string }).key;

    expect(summaries["state.init"]).toMatchObject({
      pluginKey,
      pluginLabel: "Early plugin",
      count: 1,
      total: 4,
      average: 4,
    });
    expect(summaries["view.create"]).toMatchObject({
      pluginKey,
      pluginLabel: "Early plugin",
      count: 1,
      total: 6,
      average: 6,
    });

    attachment.detach();
    view.destroy();
  });

  it("publishes an updated snapshot when a plugin hook runs outside dispatch", async () => {
    let clock = 100;
    vi.spyOn(performance, "now").mockImplementation(() => clock);

    const original = new Plugin({
      props: {
        handleKeyDown() {
          clock += 9;
          return true;
        },
      },
    });
    const store = createProseMirrorDevtoolsStore();
    const view = { state: createTestState() } as EditorView;
    const unregister = store.register({ id: "editor", view });
    const [wrapped] = instrumentProseMirrorPlugins([original], {
      instanceId: "editor",
      store,
    });
    if (!wrapped) throw new Error("Expected the plugin to be instrumented");
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const previousVersion = store.getSnapshot().version;

    const handled = wrapped.props.handleKeyDown?.call(wrapped, view, {
      key: "Enter",
    } as KeyboardEvent);

    expect(handled).toBe(true);
    expect(store.getSnapshot().version).toBe(previousVersion + 1);
    expect(listener).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getSnapshot().instances[0]?.pluginTimings).toEqual([
      expect.objectContaining({
        hook: "props.handleKeyDown",
        count: 1,
        total: 9,
      }),
    ]);

    unsubscribe();
    unregister();
  });

  it("keeps wrapped NodeView method identities stable", () => {
    const store = createProseMirrorDevtoolsStore();
    const view = { state: createTestState() } as EditorView;
    store.register({ id: "editor", view });
    const nodeView = {
      dom: document.createElement("div"),
      update: vi.fn(() => true),
    };
    const plugin = new Plugin({
      props: {
        nodeViews: {
          paragraph: () => nodeView,
        },
      },
    });
    const [wrapped] = instrumentProseMirrorPlugins([plugin], { instanceId: "editor", store });
    const factory = wrapped?.props.nodeViews?.paragraph;
    if (!factory) throw new Error("Expected an instrumented node view factory");
    const measuredNodeView = factory(
      view.state.doc.firstChild as NonNullable<typeof view.state.doc.firstChild>,
      view,
      () => 0,
      [],
      DecorationSet.empty,
    );

    expect(measuredNodeView.update).toBe(measuredNodeView.update);
    measuredNodeView.update?.(
      view.state.doc.firstChild as NonNullable<typeof view.state.doc.firstChild>,
      [],
      DecorationSet.empty,
    );
    expect(nodeView.update).toHaveBeenCalledOnce();
    expect(store.getInstance("editor")?.pluginTimings).toEqual(
      expect.arrayContaining([expect.objectContaining({ hook: "nodeView.update", count: 1 })]),
    );
  });

  it("preserves private-field accessors and methods on class-based NodeViews", () => {
    const store = createProseMirrorDevtoolsStore();
    const view = { state: createTestState() } as EditorView;
    store.register({ id: "editor", view });
    class ParagraphView {
      readonly #dom = document.createElement("p");
      #updates = 0;

      get dom() {
        return this.#dom;
      }

      get updates() {
        return this.#updates;
      }

      update() {
        this.#updates += 1;
        return true;
      }
    }
    const nodeView = new ParagraphView();
    const plugin = new Plugin({ props: { nodeViews: { paragraph: () => nodeView } } });
    const [wrapped] = instrumentProseMirrorPlugins([plugin], { instanceId: "editor", store });
    const factory = wrapped?.props.nodeViews?.paragraph;
    if (!factory) throw new Error("Expected an instrumented node view factory");
    const measured = factory(view.state.doc.firstChild!, view, () => 0, [], DecorationSet.empty);

    expect(measured.dom).toBe(nodeView.dom);
    expect(measured.update?.(view.state.doc.firstChild!, [], DecorationSet.empty)).toBe(true);
    expect(nodeView.updates).toBe(1);
  });
});
